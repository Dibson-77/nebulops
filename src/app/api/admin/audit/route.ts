import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { PaginationService } from "@/lib/pagination";

/**
 * GET /api/admin/audit
 * ────────────────────
 * Retourne le journal d'audit global (Admin seulement), paginé.
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireProfile(["Administrateur"]);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const params = {
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 10,
      search: searchParams.get("search") || undefined,
      all: searchParams.get("all") === "true",
    };

    const result = await PaginationService.paginate("auditLog", params, {
      include: {
        user: { select: { email: true } },
      },
      orderBy: { createdAt: "desc" },
      searchables: ["action", "target"],
    });

    const mappedData = result.data.map((l: any) => ({
      id: l.id,
      action: l.action,
      target: l.target,
      actorEmail: l.user.email,
      createdAt: l.createdAt,
      ip: l.ip || "--",
    }));

    return NextResponse.json({
      data: mappedData,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error("[GET /api/admin/audit]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
