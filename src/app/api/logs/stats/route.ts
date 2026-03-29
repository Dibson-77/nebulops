import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/session";

/**
 * GET /api/logs/stats
 * Statistiques rapides pour le header de la page /logs.
 */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const [total, unresolved, byLevel, bySource] = await Promise.all([
    prisma.serverLog.count(),
    prisma.serverLog.count({ where: { isResolved: false } }),
    prisma.serverLog.groupBy({ by: ["level"], _count: { id: true } }),
    prisma.serverLog.groupBy({ by: ["source"], _count: { id: true } }),
  ]);

  return NextResponse.json({
    total,
    unresolved,
    byLevel:  Object.fromEntries(byLevel.map(r => [r.level, r._count.id])),
    bySource: Object.fromEntries(bySource.map(r => [r.source, r._count.id])),
  });
}
