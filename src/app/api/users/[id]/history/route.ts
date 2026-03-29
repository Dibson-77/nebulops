import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { PaginationService } from "@/lib/pagination";

/**
 * GET /api/users/[id]/history
 * ───────────────────────────
 * Retourne l'historique complet d'un utilisateur (Admin seulement).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProfile(["Administrateur"]);
    if (auth.error) return auth.error;

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const { searchParams } = new URL(req.url);
    const paginationParams = {
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 10,
      all: searchParams.get("all") === "true",
    };

    const [allLoginHistory, allAuditLogs] = await Promise.all([
      prisma.loginHistory.findMany({
        where: { userId: id },
        orderBy: { connectedAt: "desc" },
      }),
      prisma.auditLog.findMany({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const loginHistoryResult = PaginationService.paginateInMemory(allLoginHistory, paginationParams);
    const auditLogsResult = PaginationService.paginateInMemory(allAuditLogs, paginationParams);

    return NextResponse.json({
      loginHistory: loginHistoryResult,
      auditLogs: auditLogsResult,
    });
  } catch (error) {
    console.error("[GET /api/users/:id/history]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
