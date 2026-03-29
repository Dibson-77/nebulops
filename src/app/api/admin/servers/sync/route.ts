import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { triggerAlertIfNeeded, loadAlertSettings } from "@/lib/alerts/notify";
import { ingestLog } from "@/lib/logs/ingest";

/**
 * POST /api/admin/servers/sync
 * ────────────────────────────
 * Déclenche une synchronisation de TOUS les serveurs.
 * Interroge chaque agent (metrics + docker + processes), sauvegarde en DB.
 * Déclenche les alertes WhatsApp si les seuils sont dépassés.
 * Ingère les logs des conteneurs qui passent en état Exited.
 */

const AGENT_TIMEOUT_MS = 5000;

export async function POST() {
  try {
    const servers = await prisma.server.findMany();

    // Chargé une fois pour toute la boucle — si indisponible (ex: client non régénéré),
    // on utilise des defaults qui désactivent les alertes sans crasher le sync.
    const alertSettings = await loadAlertSettings().catch(() => ({
      id: 1, whatsappEnabled: false, whatsappTo: "", twilioAccountSid: "",
      twilioAuthToken: "", twilioFrom: "", diskThreshold: 80, cpuThreshold: 85,
      ramThreshold: 90, cooldownMinutes: 30, updatedAt: new Date(),
    }));

    if (servers.length === 0) {
      return NextResponse.json({ message: "Aucun serveur à synchroniser." });
    }

    const results = await Promise.allSettled(
      servers.map(async (server) => {
        const token = server.agentToken || process.env.FLEETOPS_TOKEN || "";
        const baseUrl = `http://${server.ip}:${server.agentPort}`;
        const headers: Record<string, string> = {
          "Accept": "application/json",
          "X-NebulOps-Token": token,
          "X-FleetOps-Token": token,
        };

        try {
          console.log(`[SYNC] ${server.name} (id=${server.id}) → ${baseUrl}/metrics`);

          const [metricsRes, dockerRes, procRes, logsRes] = await Promise.allSettled([
            fetch(`${baseUrl}/metrics`,   { headers, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS), cache: "no-store" }),
            fetch(`${baseUrl}/docker`,    { headers, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS), cache: "no-store" }),
            fetch(`${baseUrl}/processes`, { headers, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS), cache: "no-store" }),
            fetch(`${baseUrl}/logs`,      { headers, signal: AbortSignal.timeout(AGENT_TIMEOUT_MS), cache: "no-store" }),
          ]);

          // ── Metrics (obligatoire) ──────────────────────────────────
          if (metricsRes.status !== "fulfilled") {
            const reason = metricsRes.reason;
            const detail = reason?.cause?.code || reason?.code || reason?.message || String(reason);
            console.error(`[SYNC] ${server.name} — fetch échoué: ${detail}`);
            throw new Error(`Agent unreachable (${detail})`);
          }
          if (!metricsRes.value.ok) {
            const status = metricsRes.value.status;
            // On lit le body uniquement pour diagnostiquer, sans le dumper entièrement
            const contentType = metricsRes.value.headers.get("content-type") ?? "";
            const isXml = contentType.includes("xml");
            const hint = isXml ? "réponse XML (S3/MinIO ?) — vérifiez le port de l'agent" : `HTTP ${status}`;
            console.error(`[SYNC] ${server.name} — ${hint}`);
            throw new Error(`Agent unreachable (${hint})`);
          }
          const metrics = await metricsRes.value.json();

          // ── Docker (optionnel) ─────────────────────────────────────
          let docker: any = null;
          if (dockerRes.status === "fulfilled" && dockerRes.value.ok) {
            docker = await dockerRes.value.json();
          }

          // ── Processes (optionnel) ──────────────────────────────────
          let procs: any = null;
          if (procRes.status === "fulfilled" && procRes.value.ok) {
            procs = await procRes.value.json();
          }

          // ── Logs Docker (optionnel) ────────────────────────────────
          if (logsRes.status === "fulfilled" && logsRes.value.ok) {
            const logsPayload = await logsRes.value.json();
            const agentLogs: Array<{ containerName: string; level: string; message: string }> =
              logsPayload?.logs ?? [];
            if (agentLogs.length > 0) {
              await Promise.allSettled(
                agentLogs.map((entry) =>
                  ingestLog({
                    serverId:      server.id,
                    source:        "DOCKER",
                    level:         entry.level as "WARN" | "ERROR" | "FATAL",
                    message:       entry.message,
                    containerName: entry.containerName,
                  }).catch(() => null)
                )
              );
            }
          }

          // ── Détection des conteneurs Exited → log ingestion ────────
          const containers: any[] = docker?.containers || docker || [];

          // Extrait le code de sortie depuis le champ status : "Exited (127) 3 days ago" → 127
          const getExitCode = (statusStr: string): number => {
            const m = statusStr.match(/Exited\s*\((\d+)\)/i);
            return m ? parseInt(m[1], 10) : -1;
          };

          // Seuls les conteneurs avec exit code ≠ 0 sont des erreurs réelles
          // exit 0 = arrêt volontaire/normal → on ne logue pas
          const failedContainers = containers.filter((c: any) => {
            const s = c.status ?? c.state ?? "";
            if (!/^Exited\b/i.test(s)) return false;
            return getExitCode(s) !== 0;
          });

          // Snapshot précédent pour la détection de transition (running → exited)
          const lastMetrics = await prisma.serverMetrics.findFirst({
            where: { serverId: server.id },
            orderBy: { createdAt: "desc" },
          });
          const prevContainers: any[] = lastMetrics
            ? JSON.parse(lastMetrics.containers || "[]")
            : [];

          // Map id → état précédent pour détecter les transitions
          const prevStateMap = new Map(
            prevContainers.map((c: any) => [c.name || c.id, c.state ?? c.status ?? ""])
          );

          // Ingère uniquement les conteneurs qui viennent de passer en état d'échec
          // (n'était pas exited-failed au sync précédent)
          // La déduplication par fingerprint dans ingestLog() gère les cas restants
          const logIngestions = failedContainers
            .filter((c: any) => {
              const prevState = prevStateMap.get(c.name || c.id) ?? "";
              return !/^Exited\b/i.test(prevState); // nouvelle transition uniquement
            })
            .map((c: any) => {
              const exitCode = getExitCode(c.status ?? "");
              return ingestLog({
                serverId:      server.id,
                source:        "DOCKER",
                level:         exitCode >= 127 ? "FATAL" : "ERROR",
                message:       `Conteneur en échec: ${c.name || c.id} — exit code ${exitCode}`,
                containerName: c.name || c.id,
              }).catch(() => null);
            });

          // ── Sauvegarde en DB ───────────────────────────────────────
          const computedStatus = (() => {
            if (failedContainers.length > 0) return "degraded";
            return metrics.status ?? "online";
          })();

          const [savedMetrics] = await Promise.all([
            prisma.serverMetrics.create({
              data: {
                serverId:    server.id,
                diskTotalGb: metrics.diskTotalGb  ?? 0,
                diskUsedGb:  metrics.diskUsedGb   ?? 0,
                diskFreeGb:  metrics.diskFreeGb   ?? 0,
                diskUsedPct: metrics.diskUsedPct  ?? 0,
                ramTotalGb:  metrics.ramTotalGb   ?? 0,
                ramUsedGb:   metrics.ramUsedGb    ?? 0,
                ramUsedPct:  metrics.ramUsedPct   ?? 0,
                ramFreePct:  metrics.ramFreePct   ?? 0,
                cpuLoadPct:  metrics.cpuLoadPct   ?? 0,
                cpuCores:    metrics.cpuCores     ?? 0,
                uptimeHours: metrics.uptimeHours  ?? 0,
                loadAvg:     JSON.stringify(metrics.loadAvg ?? [0, 0, 0]),
                services:    JSON.stringify(metrics.services ?? []),
                hostname:    metrics.hostname     ?? server.ip,
                os:          metrics.os           ?? "",
                kernel:      metrics.kernel       ?? "",
                agentVersion:metrics.agentVersion ?? "unknown",
                status:      computedStatus,
                containers:  JSON.stringify(containers),
                topProcesses:JSON.stringify(procs ?? []),
              },
            }),
            ...logIngestions,
          ]);

          const wasActive = server.agentActive;
          const statusChanged = wasActive !== true;
          const needsInit = !server.statusLastChangedAt;

          await prisma.server.update({
            where: { id: server.id },
            data: {
              agentActive: true,
              ...(statusChanged || needsInit ? { statusLastChangedAt: new Date() } : {}),
            },
          });

          // ── Alertes WhatsApp sur les métriques ─────────────────────
          // Ne pas attendre la résolution pour ne pas bloquer le sync
          const diskPct = metrics.diskUsedPct ?? 0;
          const cpuPct  = metrics.cpuLoadPct  ?? 0;
          const ramPct  = metrics.ramUsedPct  ?? 0;

          const alertTasks: Promise<void>[] = [];

          if (diskPct >= alertSettings.diskThreshold) {
            alertTasks.push(
              triggerAlertIfNeeded(
                server.id, "DISK_HIGH",
                `⚠️ *NebulOps — Disque critique*\n🖥️ Serveur : ${server.name} (${server.ip})\n💽 Disque utilisé : *${diskPct}%*\n\nIntervenez rapidement pour éviter une saturation.`,
                alertSettings
              ).catch(() => {})
            );
          }
          if (cpuPct >= alertSettings.cpuThreshold) {
            alertTasks.push(
              triggerAlertIfNeeded(
                server.id, "CPU_HIGH",
                `⚠️ *NebulOps — CPU élevé*\n🖥️ Serveur : ${server.name} (${server.ip})\n🔥 CPU : *${cpuPct}%*`,
                alertSettings
              ).catch(() => {})
            );
          }
          if (ramPct >= alertSettings.ramThreshold) {
            alertTasks.push(
              triggerAlertIfNeeded(
                server.id, "RAM_HIGH",
                `⚠️ *NebulOps — RAM critique*\n🖥️ Serveur : ${server.name} (${server.ip})\n🧠 RAM utilisée : *${ramPct}%*`,
                alertSettings
              ).catch(() => {})
            );
          }

          // Fire-and-forget : les alertes ne bloquent jamais le sync
          Promise.all(alertTasks).catch(() => {});

          console.log(`[SYNC] ✅ ${server.name} — OK (containers=${containers.length}, exited=${failedContainers.length})`);

          return {
            id: server.id,
            name: server.name,
            status: "success",
            containers: containers.length,
            processes: procs?.processes?.length ?? 0,
          };

        } catch (err: any) {
          // ── Serveur injoignable → marquer offline + alerte WhatsApp ─
          const detail = err?.cause?.code || err?.code || err?.message || String(err);
          console.error(`[SYNC] ❌ ${server.name} (${server.ip}:${server.agentPort}) — ${detail}`);

          const wasActive = server.agentActive;
          const statusChanged = wasActive !== false;
          const needsInit = !server.statusLastChangedAt;

          await prisma.server.update({
            where: { id: server.id },
            data: {
              agentActive: false,
              ...(statusChanged || needsInit ? { statusLastChangedAt: new Date() } : {}),
            },
          });

          // Alerte uniquement si le serveur vient de tomber (transition active → inactive)
          if (statusChanged) {
            triggerAlertIfNeeded(
              server.id, "SERVER_OFFLINE",
              `🔴 *NebulOps — Serveur hors-ligne*\n🖥️ Serveur : ${server.name}\n🌐 IP : ${server.ip}\n❌ Erreur : ${detail}\n\nVérifiez l'état du serveur immédiatement.`,
              alertSettings
            ).catch(() => {});
          }

          return { id: server.id, name: server.name, status: "error", error: String(err), detail };
        }
      })
    );

    const successCount = results.filter(
      r => r.status === "fulfilled" && (r.value as any).status === "success"
    ).length;

    // ── Broadcast WS vers les clients connectés ──────────────────
    try {
      await fetch("http://localhost:3006/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sync_complete",
          successCount,
          totalCount: servers.length,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // WS server pas démarré — pas critique
    }

    return NextResponse.json({
      message: `${successCount}/${servers.length} serveurs synchronisés.`,
      details: results,
    });

  } catch (error) {
    console.error("[SYNC_ERROR]", error);
    return NextResponse.json({ error: "Erreur lors de la synchronisation" }, { status: 500 });
  }
}
