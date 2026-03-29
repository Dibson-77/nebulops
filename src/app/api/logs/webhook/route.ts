import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ingestLog } from "@/lib/logs/ingest";
import type { LogLevel } from "@prisma/client";

// Rate-limit simple en mémoire : max 60 appels/minute par IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 60) return false;
  entry.count++;
  return true;
}

const VALID_LEVELS: LogLevel[] = ["WARN", "ERROR", "FATAL"];

/**
 * POST /api/logs/webhook
 * Endpoint public (tokenisé) pour que les applications poussent leurs erreurs.
 * Header requis : X-NebulOps-Token correspondant à un server.agentToken
 *
 * Body :
 * {
 *   level: "ERROR",
 *   message: "Unhandled exception",
 *   stackTrace?: "...",
 *   serviceName?: "user-api",
 * }
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "Rate limit dépassé" }, { status: 429 });
  }

  const token = req.headers.get("x-nebulops-token") || req.headers.get("x-fleetops-token");
  if (!token) {
    return NextResponse.json({ error: "Token requis (X-NebulOps-Token)" }, { status: 401 });
  }

  const server = await prisma.server.findFirst({ where: { agentToken: token } });
  if (!server) {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.message) {
    return NextResponse.json({ error: "message requis" }, { status: 400 });
  }

  const level: LogLevel = VALID_LEVELS.includes(body.level) ? body.level : "ERROR";

  const log = await ingestLog({
    serverId:    server.id,
    source:      "WEBHOOK",
    level,
    message:     String(body.message),
    stackTrace:  body.stackTrace ? String(body.stackTrace) : null,
    serviceName: body.serviceName ? String(body.serviceName) : null,
  });

  return NextResponse.json({ ok: true, logId: log.id }, { status: 201 });
}
