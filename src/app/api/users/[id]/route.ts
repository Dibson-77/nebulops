/**
 * app/api/users/[id]/route.ts
 * ────────────────────────────
 * PUT    /api/users/:id   → modifier profil ou statut
 * DELETE /api/users/:id   → soft delete un utilisateur
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { z } from "zod";

const UpdateUserSchema = z.object({
  firstname:   z.string().min(1).max(80).optional(),
  lastname:    z.string().min(1).max(80).optional(),
  profileId:   z.number().int().optional(),
  status:      z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
  phoneNumber: z.string().optional(),
}).strict();

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { getSession } = await import("@/lib/auth/session");
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) return NextResponse.json({ id: "ID invalide" }, { status: 400 });

    const isSelf = session.sub === id;
    
    // Si ce n'est pas soi-même, il faut être Admin
    if (!isSelf && session.profileLabel !== "Administrateur") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const body   = await req.json();
    const parsed = UpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 422 });
    }

    // Restrictions pour l'auto-modification
    const dataToUpdate = { ...parsed.data };
    if (isSelf) {
      delete dataToUpdate.profileId;
      delete dataToUpdate.status;
    }

    const user = await prisma.user.update({
      where: { id },
      data:  dataToUpdate,
      select: {
        id: true, firstname: true, lastname: true, email: true,
        phoneNumber: true,
        status: true, profile: { select: { libelle: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.sub,
        action: "UPDATE_USER",
        target: `userId:${id}`,
        ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    return NextResponse.json(user);
  } catch (error: any) {
    if (error.code === "P2025") return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    console.error("[PUT /api/users/:id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

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

    if (id === auth.session.sub) {
      return NextResponse.json({ error: "Impossible de supprimer son propre compte" }, { status: 400 });
    }

    // Soft delete
    await prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });

    await prisma.auditLog.create({
      data: { 
        userId: auth.session.sub, 
        action: "DELETE_USER", 
        target: `userId:${id}`,
        ip: req.headers.get("x-forwarded-for") || "127.0.0.1"
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    if (error.code === "P2025") return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    console.error("[DELETE /api/users/:id]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
