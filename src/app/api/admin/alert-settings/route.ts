import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/session";

/**
 * GET /api/admin/alert-settings
 */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const settings = await prisma.alertSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, updatedAt: new Date() },
  });

  return NextResponse.json(settings);
}

/**
 * PUT /api/admin/alert-settings
 */
export async function PUT(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await req.json();
  const { whatsappEnabled, whatsappTo, diskThreshold, cpuThreshold, ramThreshold, cooldownMinutes } = body;

  const data: Record<string, any> = { updatedAt: new Date() };
  if (whatsappEnabled !== undefined) data.whatsappEnabled = Boolean(whatsappEnabled);
  if (whatsappTo      !== undefined) data.whatsappTo      = String(whatsappTo);
  if (diskThreshold   !== undefined) data.diskThreshold   = Number(diskThreshold);
  if (cpuThreshold    !== undefined) data.cpuThreshold    = Number(cpuThreshold);
  if (ramThreshold    !== undefined) data.ramThreshold    = Number(ramThreshold);
  if (cooldownMinutes !== undefined) data.cooldownMinutes = Number(cooldownMinutes);

  const updated = await prisma.alertSettings.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });

  return NextResponse.json(updated);
}
