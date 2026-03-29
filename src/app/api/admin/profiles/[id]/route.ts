import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { z } from "zod";

const ProfileUpdateSchema = z.object({
  libelle:     z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  permissions: z.array(z.string()).optional(),
});

/**
 * PUT /api/admin/profiles/[id]
 * ────────────────────────────
 * Modifier un profil (Admin seulement).
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProfile(["Administrateur"]);
    if (auth.error) return auth.error;

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const body = await req.json();
    const parsed = ProfileUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
    }

    const { libelle, description, permissions } = parsed.data;

    const profile = await prisma.profile.update({
      where: { id },
      data: {
        libelle:     libelle ?? undefined,
        description: description ?? undefined,
        permissions: permissions ? {
          set: [], // Vider d'abord (Prisma implicit many-to-many)
          connect: permissions.map((code: string) => ({ code })),
        } : undefined,
      },
      include: { permissions: true }
    });

    // Logging
    await prisma.auditLog.create({
      data: {
        userId: auth.session.sub,
        action: "UPDATE_PROFILE",
        target: profile.libelle,
        ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    const mapped = {
      ...profile,
      permissions: profile.permissions.map(pm => pm.label)
    };

    return NextResponse.json(mapped);
  } catch (error: any) {
    if (error.code === "P2025") return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    console.error("[PUT /api/admin/profiles/:id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/profiles/[id]
 * ───────────────────────────────
 * Soft delete un profil (Admin seulement).
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireProfile(["Administrateur"]);
    if (auth.error) return auth.error;

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

    const profile = await prisma.profile.findUnique({ where: { id } });
    if (!profile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });

    // Sécurité : Ne pas supprimer les profils système
    if (["Administrateur", "Utilisateur"].includes(profile.libelle)) {
      return NextResponse.json({ error: "Impossible de supprimer ce profil système" }, { status: 400 });
    }

    await prisma.profile.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.session.sub,
        action: "DELETE_PROFILE",
        target: profile.libelle,
        ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    if (error.code === "P2025") return NextResponse.json({ error: "Profil introuvable" }, { status: 404 });
    if (error.code === "P2003") {
      return NextResponse.json({ 
        error: "Impossible de supprimer ce profil car il est encore utilisé par des utilisateurs." 
      }, { status: 400 });
    }
    console.error("[DELETE /api/admin/profiles/:id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
