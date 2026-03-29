// ─── Utility Functions ───────────────────────────────────────────────────────

export function diskColor(pct: number): string {
  if (pct >= 85) return "#d95565";
  if (pct >= 75) return "#d4a843";
  if (pct >= 60) return "#5b8def";
  return "#4dab8a";
}

export function formatGb(gb: number): string {
  if (!gb) return "—";
  if (gb >= 1000) return `${(gb / 1024).toFixed(1)} To`;
  return `${gb} Go`;
}

export function pct(used: number, total: number): number {
  if (!total) return 0;
  return Math.round((used / total) * 100);
}
