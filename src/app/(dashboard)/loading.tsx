"use client";

/**
 * Loading skeleton for dashboard pages.
 * Uses CSS variables (set by html.dark class) instead of Zustand store
 * to avoid the white flash on refresh in dark mode.
 */

export default function DashboardLoading() {
  return (
    <div style={{ padding: "32px" }}>
      {/* KPI Row */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-block" style={{ flex: 1, height: "100px" }} />
        ))}
      </div>

      {/* Grid Row 1 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
        <div className="skeleton-block" style={{ height: "300px" }} />
        <div className="skeleton-block" style={{ height: "300px" }} />
      </div>

      {/* Grid Row 2 */}
      <div className="skeleton-block" style={{ height: "400px" }} />

      <style>{`
        .skeleton-block {
          border-radius: 12px;
          animation: pulse 2s infinite ease-in-out;
          background: rgba(128, 128, 128, 0.08);
        }
        html.dark .skeleton-block {
          background: rgba(255, 255, 255, 0.04);
        }
      `}</style>
    </div>
  );
}
