import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/session";
import { PaginationService } from "@/lib/pagination";
import type { LogLevel, LogSource } from "@prisma/client";

/**
 * GET /api/logs
 * Liste tous les logs (tous serveurs) avec filtres :
 * ?level=ERROR,FATAL&source=DOCKER&serverId=1&search=keyword&isResolved=false&page=1&limit=20
 */
export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const page   = searchParams.get("page")   || "1";
  const limit  = searchParams.get("limit")  || "20";
  const search = searchParams.get("search") || undefined;
  const levelParam    = searchParams.get("level");
  const sourceParam   = searchParams.get("source");
  const serverIdParam = searchParams.get("serverId");
  const isResolvedParam = searchParams.get("isResolved");

  const where: Record<string, any> = {};

  if (levelParam) {
    const levels = levelParam.split(",").filter(Boolean) as LogLevel[];
    if (levels.length) where.level = { in: levels };
  }
  if (sourceParam) {
    const sources = sourceParam.split(",").filter(Boolean) as LogSource[];
    if (sources.length) where.source = { in: sources };
  }
  if (serverIdParam) where.serverId = Number(serverIdParam);
  if (isResolvedParam !== null && isResolvedParam !== "") {
    where.isResolved = isResolvedParam === "true";
  }
  if (search) {
    where.OR = [
      { message:    { contains: search, mode: "insensitive" } },
      { stackTrace: { contains: search, mode: "insensitive" } },
      { containerName: { contains: search, mode: "insensitive" } },
    ];
  }

  const result = await PaginationService.paginate("serverLog" as any, { page, limit }, {
    where,
    include: { server: { select: { id: true, name: true, ip: true, environment: true } } },
    orderBy: { lastSeenAt: "desc" },
  });

  return NextResponse.json(result);
}
