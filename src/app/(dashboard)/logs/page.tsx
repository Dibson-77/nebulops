"use client";

/**
 * app/(dashboard)/logs/page.tsx
 * ──────────────────────────────
 * Vue globale des logs d'erreurs de tous les serveurs.
 */

import { useState, useEffect } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useTokens } from "@/hooks/use-tokens";
import { apiFetch } from "@/lib/api-client";
import { LogsPanel } from "@/components/dashboard/LogsPanel";
import type { LogStats } from "@/types";
import { AlertTriangle, AlertOctagon, FileText, CheckCircle2 } from "lucide-react";

function StatCard({ icon: Icon, label, value, color, t }: {
  icon: React.ElementType; label: string; value: number | string; color: string; t: any;
}) {
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: "12px", padding: "18px 20px",
      display: "flex", alignItems: "center", gap: "14px",
      flex: "1 1 140px", minWidth: 0,
    }}>
      <div style={{
        width: "42px", height: "42px", borderRadius: "10px", flexShrink: 0,
        background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={20} color={color} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "22px", fontWeight: 900, color: t.text, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "11px", color: t.textFaint, fontWeight: 600, marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
      </div>
    </div>
  );
}

export default function LogsPage() {
  const { dark } = useAppStore();
  const t = useTokens(dark);
  const [stats, setStats] = useState<LogStats | null>(null);

  useEffect(() => {
    apiFetch("/api/logs/stats")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); })
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* ── En-tête ── */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
          <FileText size={24} color="#5b8def" strokeWidth={2} />
          <h1 style={{ fontSize: "24px", fontWeight: 900, color: t.text, margin: 0 }}>Logs critiques</h1>
        </div>
        {stats && (
          <p style={{ color: t.textFaint, fontSize: "14px", margin: 0 }}>
            {stats.total} entrée{stats.total > 1 ? "s" : ""} · {stats.unresolved} non résolue{stats.unresolved > 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* ── Stats rapides ── */}
      {stats && (
        <>
          <style>{`
            .logs-kpi-grid {
              display: flex;
              flex-wrap: wrap;
              gap: 12px;
              margin-bottom: 28px;
            }
            .logs-kpi-grid > * {
              flex: 1 1 140px;
              min-width: 0;
            }
            @media (max-width: 480px) {
              .logs-kpi-grid > * { flex: 1 1 calc(50% - 6px); }
            }
          `}</style>
          <div className="logs-kpi-grid">
            <StatCard icon={FileText}      label="Total"       value={stats.total}               color="#5b8def" t={t} />
            <StatCard icon={CheckCircle2}  label="Non résolus" value={stats.unresolved}           color="#d95565" t={t} />
            <StatCard icon={AlertTriangle} label="Erreurs"     value={stats.byLevel?.ERROR ?? 0}  color="#e57c40" t={t} />
            <StatCard icon={AlertOctagon}  label="Fatales"     value={stats.byLevel?.FATAL ?? 0}  color="#d95565" t={t} />
          </div>
        </>
      )}

      {/* ── Panneau de logs ── */}
      <div style={{
        background: t.surface, border: `1px solid ${t.border}`,
        borderRadius: "14px", padding: "24px",
      }}>
        <LogsPanel dark={dark} />
      </div>
    </div>
  );
}
