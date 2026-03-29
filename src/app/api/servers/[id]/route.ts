/**
 * app/api/servers/[id]/route.ts
 * ──────────────────────────
 * PUT    /api/servers/[id]    → modifier un serveur (ex: activer agent)
 * DELETE /api/servers/[id]    → supprimer un serveur
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { z } from "zod";

const UpdateServerSchema = z.object({
  name:        z.string().min(2).max(80).optional(),
  environment: z.enum(["Dev", "Demo", "Pilote", "Prod", "Backup"]).optional(),
  provider:    z.enum(["OVH", "Azure", "AWS"]).optional(),
  agentPort:   z.number().int().min(1024).max(65535).optional(),
  agentActive: z.boolean().optional(),
  agentToken:  z.string().optional(),
  description: z.string().max(255).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID invalide" }, { status: 400 });
    }
    const auth = await requireProfile(["Administrateur", "Opérateur"]);
    if (auth.error) return auth.error;

    const body = await req.json();
    const parsed = UpdateServerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const server = await prisma.server.update({
      where: { id },
      data: parsed.data,
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.session.sub,
        action: "UPDATE_SERVER",
        target: `${server.ip} — ${server.name}`,
      },
    });

    return NextResponse.json(server);
  } catch (error) {
    const { id: idLog } = await params;
    console.error(`[PUT /api/servers/${idLog}]`, error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: idParam } = await params;
    const id = parseInt(idParam);
    const auth = await requireProfile(["Administrateur"]);
    if (auth.error) return auth.error;

    const server = await prisma.server.delete({
      where: { id },
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.session.sub,
        action: "DELETE_SERVER",
        target: `${server.ip} — ${server.name}`,
      },
    });

    return NextResponse.json({ message: "Serveur supprimé" });
  } catch (error) {
    const { id: idLog } = await params;
    console.error(`[DELETE /api/servers/${idLog}]`, error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
