/**
 * app/api/servers/[id]/metrics/route.ts
 * ──────────────────────────────────────
 * GET  /api/servers/:id/metrics          → lecture DB uniquement (pas d'appel agent)
 * GET  /api/servers/:id/metrics?history=10  → historique des N dernières mesures
 *
 * L'interrogation de l'agent se fait UNIQUEMENT via /api/admin/servers/sync
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const historyCount = parseInt(searchParams.get("history") ?? "0");

    // ── Mode historique ──────────────────────────────────────────────────────
    if (historyCount > 0) {
      const history = await prisma.serverMetrics.findMany({
        where:   { serverId: id },
        orderBy: { createdAt: "desc" },
        take:    Math.min(historyCount, 100),
      });

      const parsedHistory = history.map(dbM => {
        const m: any = { ...dbM };
        try {
          if (typeof m.services === "string") m.services = JSON.parse(m.services);
          if (typeof m.loadAvg === "string") m.loadAvg = JSON.parse(m.loadAvg);
          if (typeof m.containers === "string") m.containers = JSON.parse(m.containers);
          if (typeof m.topProcesses === "string") m.topProcesses = JSON.parse(m.topProcesses);
        } catch (e) {
          m.services = [];
          m.loadAvg = [0, 0, 0];
        }
        return m;
      });

      return NextResponse.json(parsedHistory.reverse());
    }

    // ── Mode lecture simple : dernière métrique en DB ─────────────────────────
    const server = await prisma.server.findUnique({ where: { id } });
    if (!server) return NextResponse.json({ error: "Serveur introuvable" }, { status: 404 });

    const lastMetric = await prisma.serverMetrics.findFirst({
      where:   { serverId: id },
      orderBy: { createdAt: "desc" },
    });

    let metrics: any = null;
    if (lastMetric) {
      metrics = { ...lastMetric };
      try {
        if (typeof metrics.services === "string") metrics.services = JSON.parse(metrics.services);
        if (typeof metrics.loadAvg === "string") metrics.loadAvg = JSON.parse(metrics.loadAvg);
        if (typeof metrics.containers === "string") metrics.containers = JSON.parse(metrics.containers);
        if (typeof metrics.topProcesses === "string") metrics.topProcesses = JSON.parse(metrics.topProcesses);
      } catch (e) {
        metrics.services = [];
        metrics.loadAvg = [0, 0, 0];
        metrics.containers = [];
        metrics.topProcesses = [];
      }
    }

    return NextResponse.json({
      serverId:    id,
      serverName:  server.name,
      serverIp:    server.ip,
      agentActive: server.agentActive,
      lastSeen:    lastMetric?.createdAt?.toISOString() ?? null,
      isStale:     !server.agentActive,
      ...(metrics ?? { status: "unknown" }),
    });

  } catch (error) {
    console.error("[GET /api/servers/:id/metrics]", error);
    return NextResponse.json({ error: "Erreur serveur interne" }, { status: 500 });
  }
}
