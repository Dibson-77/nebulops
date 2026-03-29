/**
 * lib/metrics/collector.ts
 * ────────────────────────
 * Client pour interroger les agents FleetOps distants.
 */

import { prisma } from "@/lib/prisma";

export interface AgentMetrics {
  diskTotalGb: number;
  diskUsedGb: number;
  diskFreeGb: number;
  diskUsedPct: number;
  ramTotalGb: number;
  ramUsedGb: number;
  ramFreeGb: number;
  ramUsedPct: number;
  ramFreePct: number;
  cpuLoadPct: number;
  cpuCores: number;
  loadAvg: number[];
  uptimeHours: number;
  services: { name: string; status: string }[];
  hostname: string;
  os: string;
  kernel: string;
  agentVersion: string;
  status: "online" | "degraded" | "error";
  collectedAt: string;
}

/**
 * Interroge un agent spécifique et retourne ses métriques.
 */
export async function fetchAgentMetrics(
  ip: string,
  port: number = 9101,
  token?: string
): Promise<AgentMetrics> {
  const url = `http://${ip}:${port}/metrics`;
  const headers: Record<string, string> = {};
  if (token) headers["X-FleetOps-Token"] = token;

  try {
    const res = await fetch(url, {
      headers,
      next: { revalidate: 0 }, // Pas de cache Next.js
      signal: AbortSignal.timeout(5000), // Timeout de 5s
    });

    if (!res.ok) {
      throw new Error(`Agent HTTP Error: ${res.status}`);
    }

    return await res.json();
  } catch (error) {
    console.error(`[COLLECTOR] ❌ Erreur sur ${ip}:${port} :`, error);
    throw error;
  }
}

/**
 * Enregistre une capture de métriques en base de données.
 */
export async function saveServerMetrics(serverId: number, data: AgentMetrics) {
  return await prisma.serverMetrics.create({
    data: {
      serverId,
      diskTotalGb:  data.diskTotalGb,
      diskUsedGb:   data.diskUsedGb,
      diskFreeGb:   data.diskFreeGb,
      diskUsedPct:  data.diskUsedPct,
      ramTotalGb:   data.ramTotalGb,
      ramUsedGb:    data.ramUsedGb,
      ramUsedPct:   data.ramUsedPct,
      ramFreePct:   data.ramFreePct,
      cpuLoadPct:   data.cpuLoadPct,
      cpuCores:     data.cpuCores,
      uptimeHours:  data.uptimeHours,
      loadAvg:      JSON.stringify(data.loadAvg),
      services:     JSON.stringify(data.services),
      hostname:     data.hostname,
      os:           data.os,
      kernel:       data.kernel,
      agentVersion: data.agentVersion,
      status:       data.status,
    },
  });
}
