import { prisma } from "@/lib/prisma";
import { computeFingerprint } from "./fingerprint";
import type { LogLevel, LogSource } from "@prisma/client";

export interface IngestLogInput {
  serverId: number;
  source: LogSource;
  level: LogLevel;
  message: string;
  stackTrace?: string | null;
  containerName?: string | null;
  serviceName?: string | null;
}

/**
 * Ingère un log avec déduplication par fingerprint.
 * - Si un log identique existe déjà (même fingerprint, non résolu) → incrémente occurrences + lastSeenAt
 * - Sinon → crée un nouveau ServerLog
 *
 * Retourne le log créé ou mis à jour.
 */
export async function ingestLog(input: IngestLogInput) {
  const fingerprint = computeFingerprint({
    serverId: input.serverId,
    source: input.source,
    message: input.message,
    containerName: input.containerName,
  });

  const existing = await prisma.serverLog.findFirst({
    where: { fingerprint, isResolved: false },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return prisma.serverLog.update({
      where: { id: existing.id },
      data: {
        occurrences: { increment: 1 },
        lastSeenAt: new Date(),
        // Met à jour le stackTrace si le nouveau est plus informatif
        ...(input.stackTrace && !existing.stackTrace ? { stackTrace: input.stackTrace } : {}),
      },
    });
  }

  return prisma.serverLog.create({
    data: {
      serverId: input.serverId,
      source: input.source,
      level: input.level,
      message: input.message,
      stackTrace: input.stackTrace ?? null,
      containerName: input.containerName ?? null,
      serviceName: input.serviceName ?? null,
      fingerprint,
    },
  });
}
