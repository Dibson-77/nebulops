/**
 * app/api/servers/metrics/refresh-all/route.ts
 * ─────────────────────────────────────────────
 * POST /api/servers/metrics/refresh-all
 *
 * Poll tous les agents en parallèle et retourne un résumé.
 * Appelé par le cron interne (app/api/cron/route.ts) ou manuellement.
 *
 * ⚠️  Protéger cette route avec CRON_SECRET en production.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const AGENT_TIMEOUT_MS = 3000;
const AGENT_TOKEN      = process.env.AGENT_AUTH_TOKEN ?? "";
const CRON_SECRET      = process.env.CRON_SECRET ?? "";

export async function POST(req: NextRequest) {
  // Vérification du secret cron (header ou query param)
  const secret =
    req.headers.get("x-cron-secret") ??
    new URL(req.url).searchParams.get("secret") ??
    "";

  if (CRON_SECRET && secret !== CRON_SECRET) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const servers = await prisma.server.findMany({ select: { id: true, ip: true, agentPort: true, name: true } });

  const results = await Promise.allSettled(
    servers.map(async (server) => {
      try {
        const headers: Record<string, string> = { Accept: "application/json" };
        if (AGENT_TOKEN) headers["X-FleetOps-Token"] = AGENT_TOKEN;

        const res  = await fetch(`http://${server.ip}:${server.agentPort}/metrics`, {
          headers,
          signal: AbortSignal.timeout(AGENT_TIMEOUT_MS),
          cache: "no-store",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        await prisma.serverMetrics.create({
          data: {
            serverId:    server.id,
            diskTotalGb: data.diskTotalGb ?? 0,
            diskUsedGb:  data.diskUsedGb  ?? 0,
            diskFreeGb:  data.diskFreeGb  ?? 0,
            diskUsedPct: data.diskUsedPct ?? 0,
            ramTotalGb:  data.ramTotalGb  ?? 0,
            ramUsedGb:   data.ramUsedGb   ?? 0,
            ramUsedPct:  data.ramUsedPct  ?? 0,
            ramFreePct:  data.ramFreePct  ?? 0,
            cpuLoadPct:  data.cpuLoadPct  ?? 0,
            cpuCores:    data.cpuCores    ?? 0,
            uptimeHours: data.uptimeHours ?? 0,
            loadAvg:     JSON.stringify(data.loadAvg  ?? [0, 0, 0]),
            services:    JSON.stringify(data.services ?? []),
            hostname:    data.hostname    ?? server.ip,
            os:          data.os          ?? "",
            kernel:      data.kernel      ?? "",
            agentVersion:data.agentVersion ?? "unknown",
            status:      data.status      ?? "online",
          },
        });

        await prisma.server.update({ where: { id: server.id }, data: { agentActive: true } });
        return { id: server.id, name: server.name, status: "ok" };

      } catch (err: any) {
        await prisma.server.update({ where: { id: server.id }, data: { agentActive: false } });
        return { id: server.id, name: server.name, status: "offline", error: err.message };
      }
    })
  );

  const summary = results.map(r => r.status === "fulfilled" ? r.value : { status: "error" });
  const online  = summary.filter(s => s.status === "ok").length;
  const offline = summary.filter(s => s.status !== "ok").length;

  return NextResponse.json({
    polledAt:    new Date().toISOString(),
    total:       servers.length,
    online,
    offline,
    results:     summary,
  });
}
