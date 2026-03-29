import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

/** GET /api/logs/:id — Détail complet d'un log */
export async function GET(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const log = await prisma.serverLog.findUnique({
    where: { id: Number(id) },
    include: { server: { select: { id: true, name: true, ip: true, environment: true } } },
  });

  if (!log) return NextResponse.json({ error: "Log introuvable" }, { status: 404 });
  return NextResponse.json(log);
}

/** PATCH /api/logs/:id — Résoudre ou rouvrir un log */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const { isResolved } = await req.json();

  const log = await prisma.serverLog.update({
    where: { id: Number(id) },
    data: {
      isResolved: Boolean(isResolved),
      resolvedAt: isResolved ? new Date() : null,
    },
  });

  return NextResponse.json(log);
}

/** DELETE /api/logs/:id — Supprimer un log */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  await prisma.serverLog.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
