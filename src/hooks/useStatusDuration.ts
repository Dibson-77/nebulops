"use client";

import { useRef, useCallback } from "react";

/**
 * useStatusDuration
 * ─────────────────
 * Tracks how long each server has been in its current status.
 * Compares consecutive pool results:
 *   - Same status → keep counting from the original timestamp
 *   - Status changed → reset timestamp to now
 *
 * Purely client-side — does NOT touch sync, store, or backend.
 */

interface StatusEntry {
  status: string;  // "online" | "offline" | "degraded" | "unknown"
  since: number;   // Date.now() when this status started
}

export function useStatusDuration() {
  const mapRef = useRef<Map<number, StatusEntry>>(new Map());

  /**
   * Returns the timestamp (ms) since which this server has been in the given status.
   * Call this each time new pool data arrives for a server.
   */
  const getStatusSince = useCallback((serverId: number, currentStatus: string): number => {
    const map = mapRef.current;
    const existing = map.get(serverId);

    if (!existing) {
      // First time we see this server — init
      const now = Date.now();
      map.set(serverId, { status: currentStatus, since: now });
      return now;
    }

    if (existing.status === currentStatus) {
      // Status unchanged between pools — keep counting
      return existing.since;
    }

    // Status changed between pools — reset timer
    const now = Date.now();
    map.set(serverId, { status: currentStatus, since: now });
    return now;
  }, []);

  return { getStatusSince };
}
