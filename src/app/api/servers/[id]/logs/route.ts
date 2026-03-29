import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/session";
import { PaginationService } from "@/lib/pagination";
import type { LogLevel, LogSource } from "@prisma/client";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/servers/:id/logs
 * Logs d'un serveur précis avec filtres (level, source, search, isResolved).
 */
export async function GET(req: NextRequest, { params }: Params) {
  const { error } = await requireAuth();
  if (error) return error;

  const { id } = await params;
  const serverId = Number(id);
  const { searchParams } = new URL(req.url);

  const where: Record<string, any> = { serverId };

  const levelParam = searchParams.get("level");
  const sourceParam = searchParams.get("source");
  const search = searchParams.get("search");
  const isResolvedParam = searchParams.get("isResolved");
  const containerParam = searchParams.get("container");

  if (levelParam) {
    const levels = levelParam.split(",").filter(Boolean) as LogLevel[];
    if (levels.length) where.level = { in: levels };
  }
  if (sourceParam) {
    const sources = sourceParam.split(",").filter(Boolean) as LogSource[];
    if (sources.length) where.source = { in: sources };
  }
  if (isResolvedParam !== null && isResolvedParam !== "") {
    where.isResolved = isResolvedParam === "true";
  }
  if (containerParam) {
    where.containerName = containerParam;
  }
  if (search) {
    where.OR = [
      { message:       { contains: search, mode: "insensitive" } },
      { stackTrace:    { contains: search, mode: "insensitive" } },
      { containerName: { contains: search, mode: "insensitive" } },
    ];
  }

  const result = await PaginationService.paginate("serverLog" as any, {
    page:  searchParams.get("page")  || "1",
    limit: searchParams.get("limit") || "20",
  }, {
    where,
    orderBy: { lastSeenAt: "desc" },
  });

  return NextResponse.json(result);
}
