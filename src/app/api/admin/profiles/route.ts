import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { z } from "zod";

const ProfileSchema = z.object({
  libelle:     z.string().min(1).max(50),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

/**
 * GET /api/admin/profiles
 * ───────────────────────
 * Liste tous les profils (Admin seulement).
 */
import { PaginationService } from "@/lib/pagination";

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

    const result = await PaginationService.paginate("profile", params, {
      include: { permissions: true },
      orderBy: { libelle: "asc" },
      searchables: ["libelle", "description"],
    });

    const mappedData = result.data.map((p: any) => ({
      ...p,
      permissions: p.permissions.map((pm: any) => pm.label)
    }));

    return NextResponse.json({
      data: mappedData,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error("[GET /api/admin/profiles]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * POST /api/admin/profiles
 * ────────────────────────
 * Créer un nouveau profil (Admin seulement).
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireProfile(["Administrateur"]);
    if (auth.error) return auth.error;

    const body = await req.json();
    const parsed = ProfileSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
    }

    const { libelle, description, permissions } = parsed.data;

    const existing = await prisma.profile.findUnique({ where: { libelle } });
    if (existing) {
      return NextResponse.json({ error: "Ce profil existe déjà" }, { status: 409 });
    }

    const profile = await prisma.profile.create({
      data: {
        libelle,
        description,
        permissions: {
          connect: permissions ? permissions.map((code: string) => ({ code })) : [],
        },
      },
      include: { permissions: true }
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.session.sub,
        action: "CREATE_PROFILE",
        target: libelle,
        ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    const mapped = {
      ...profile,
      permissions: profile.permissions.map(pm => pm.label)
    };

    return NextResponse.json(mapped, { status: 201 });
  } catch (error) {
    console.error("[POST /api/admin/profiles]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
