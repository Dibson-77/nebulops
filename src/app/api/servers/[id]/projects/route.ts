/**
 * app/api/servers/[id]/projects/route.ts
 * ──────────────────────────────────────
 * POST   /api/servers/[id]/projects    → ajouter un projet
 * DELETE /api/servers/[id]/projects    → supprimer un projet
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { z } from "zod";

const ProjectSchema = z.object({
  name: z.string().min(1).max(50),
});

const DeleteProjectSchema = z.object({
  projectId: z.number().int(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const serverId = parseInt(idParam);
    if (isNaN(serverId)) {
      return NextResponse.json({ error: "ID de serveur invalide" }, { status: 400 });
    }

    const auth = await requireProfile(["Administrateur", "Opérateur"]);
    if (auth.error) return auth.error;

    const body = await req.json();
    const parsed = ProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Nom de projet invalide" }, { status: 422 });
    }

    // Créer le projet
    const project = await prisma.project.create({
      data: {
        name: parsed.data.name,
        serverId: serverId,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: "Ce projet existe déjà sur ce serveur" }, { status: 409 });
    }
    console.error(`[POST /api/servers/projects]`, error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const serverId = parseInt(idParam);
    
    const auth = await requireProfile(["Administrateur", "Opérateur"]);
    if (auth.error) return auth.error;

    const body = await req.json();
    const parsed = DeleteProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "ID de projet manquant" }, { status: 422 });
    }

    // Supprimer le projet en vérifiant qu'il appartient bien au serveur
    await prisma.project.delete({
      where: {
        id: parsed.data.projectId,
        serverId: serverId, // Sécurité supplémentaire
      },
    });

    return NextResponse.json({ message: "Projet supprimé" });
  } catch (error) {
    console.error(`[DELETE /api/servers/projects]`, error);
    return NextResponse.json({ error: "Erreur serveur ou projet introuvable" }, { status: 500 });
  }
}
