/**
 * app/api/servers/route.ts
 * ────────────────────────
 * GET  /api/servers          → liste tous les serveurs (avec dernières métriques)
 * POST /api/servers          → créer un nouveau serveur
 * v2: Includes projects
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireProfile } from "@/lib/auth/session";
import { z } from "zod";
import { PaginationService } from "@/lib/pagination";

// ─── SCHÉMA DE VALIDATION ─────────────────────────────────────────────────────

const CreateServerSchema = z.object({
  ip:          z.string().min(1, "L'IP ou le nom d'hôte est requis"),
  name:        z.string().min(2).max(80),
  environment: z.enum(["Dev", "Demo", "Pilote", "Prod", "Backup"]),
  provider:    z.enum(["OVH", "Azure", "AWS"]),
  agentPort:   z.number().int().min(1024).max(65535).default(9101),
  agentToken:  z.string().optional().default(""),
  description: z.string().max(255).optional().default(""),
});

// ─── GET /api/servers ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const env      = searchParams.get("environment");
    const provider = searchParams.get("provider");

    const servers = await prisma.server.findMany({
      where: {
        ...(env      ? { environment: env as any }      : {}),
        ...(provider ? { provider:    provider as any }  : {}),
      },
      include: {
        projects: true,
        metrics: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: [
        { environment: "asc" },
        { name: "asc" },
      ],
    });

    const result = servers.map(s => {
      const dbMetric = s.metrics[0] ?? null;
      let latestMetric: any = null;

      if (dbMetric) {
        latestMetric = { ...dbMetric }; // Clone pour éviter les soucis de mutation Prisma
        try {
          if (typeof latestMetric.services === "string") {
            latestMetric.services = JSON.parse(latestMetric.services);
          }
          if (typeof latestMetric.loadAvg === "string") {
            latestMetric.loadAvg = JSON.parse(latestMetric.loadAvg);
          }
        } catch (e) {
          latestMetric.services = [];
          latestMetric.loadAvg = [0, 0, 0];
        }
        // Parse containers & topProcesses
        try {
          if (typeof latestMetric.containers === "string") {
            latestMetric.containers = JSON.parse(latestMetric.containers);
          }
          if (typeof latestMetric.topProcesses === "string") {
            latestMetric.topProcesses = JSON.parse(latestMetric.topProcesses);
          }
        } catch (e) {
          latestMetric.containers = [];
          latestMetric.topProcesses = [];
        }
      }
      // Extraire containers/topProcesses de metrics pour éviter la duplication
      const containers   = latestMetric?.containers   ?? [];
      const topProcesses = latestMetric?.topProcesses ?? [];
      if (latestMetric) {
        delete latestMetric.containers;
        delete latestMetric.topProcesses;
      }
      return {
        ...s,
        metrics: latestMetric,
        containers,
        topProcesses,
      };
    });

    const paginationParams = {
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 10,
      all: searchParams.get("all") === "true",
    };

    const paginatedResult = PaginationService.paginateInMemory(result, paginationParams);

    return NextResponse.json(paginatedResult);
  } catch (error) {
    console.error("[GET /api/servers]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

// ─── POST /api/servers ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const auth = await requireProfile(["Administrateur", "Opérateur"]);
    if (auth.error) return auth.error;

    const body   = await req.json();
    const parsed = CreateServerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const existing = await prisma.server.findUnique({ where: { ip: parsed.data.ip } });
    if (existing) {
      return NextResponse.json({ error: "Cette IP est déjà enregistrée" }, { status: 409 });
    }

    const server = await prisma.server.create({
      data: {
        ...parsed.data,
        agentActive: true,
      },
      include: {
        projects: true
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: auth.session.sub,
        action: "CREATE_SERVER",
        target: `${server.ip} — ${server.name}`,
      },
    });

    return NextResponse.json(server, { status: 201 });
  } catch (error) {
    console.error("[POST /api/servers]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
