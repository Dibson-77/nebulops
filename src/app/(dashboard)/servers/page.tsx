"use client";

/**
 * app/(dashboard)/servers/page.tsx
 * ──────────────────────────────────
 * Vue Kanban par environnement
 * + Drawer latéral agrandi avec infos enrichies
 * + Filtrage par projet
 * + Durée du statut serveur sur la ligne du nom
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { useTokens }   from "@/hooks/use-tokens";
import { ConfirmModal } from "@/shared/components/molecules/ConfirmModal";
import { apiFetch } from "@/lib/api-client";
import { AddServerModal, AddProjectModal } from "@/components/dashboard/Modals";
import { Pagination, PaginationMeta } from "@/shared/components/molecules/Pagination";
import type { Server, Environment, Provider, Project } from "@/types";
import { AlertTriangle, Server as ServerIcon } from "lucide-react";
import DashboardLoading from "../loading";
import { Trash2, Plus, LayoutGrid, List as ListIcon, Search, Monitor, Box, Rocket, Settings, RotateCw, X, Filter, FileText } from "lucide-react";
import { LogsPanel } from "@/components/dashboard/LogsPanel";

// ─────────────────────────────────────────────────────────────────────────────
// UTILITAIRE : Temps relatif
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 10)  return "à l'instant";
  if (diff < 60)  return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}j`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}sem`;
  return `${Math.floor(diff / 2592000)}mois`;
}

function RelativeTime({ date, active }: { date: string; active: boolean }) {
  const [label, setLabel] = useState(() => timeAgo(date));
  useEffect(() => {
    setLabel(timeAgo(date));
    const id = setInterval(() => setLabel(timeAgo(date)), 5000);
    return () => clearInterval(id);
  }, [date]);
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
      background: active ? "#4dab8a18" : "#d9556518",
      color:      active ? "#4dab8a"   : "#d95565",
      border:     `1px solid ${active ? "#4dab8a33" : "#d9556533"}`,
      display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      {active ? "⬆" : "⬇"} {active ? "En ligne" : "Hors ligne"} · {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STATUS DURATION — mini component that ticks every second
// ─────────────────────────────────────────────────────────────────────────────

function StatusDuration({ since, active, t }: { since: string | Date; active: boolean; t: any }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const start = since ? new Date(since).getTime() : 0;
  if (!start || isNaN(start)) return <span style={{ fontSize: 9, color: t.textFaint }}>—</span>;

  const elapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
  let label: string;
  if (elapsed < 60)       label = `${elapsed}s`;
  else if (elapsed < 3600) label = `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;
  else if (elapsed < 86400) label = `${Math.floor(elapsed / 3600)}h ${Math.floor((elapsed % 3600) / 60)}m`;
  else                      label = `${Math.floor(elapsed / 86400)}j ${Math.floor((elapsed % 86400) / 3600)}h`;

  return (
    <span style={{
      fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
      background: active ? "#4dab8a12" : "#d9556512",
      color:      active ? "#4dab8a"   : "#d95565",
      fontFamily: "'JetBrains Mono',monospace",
      whiteSpace: "nowrap",
      display: "inline-flex", alignItems: "center", gap: 3,
    }}>
      {active ? "⬆" : "⬇"} {label}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES ENRICHIS
// ─────────────────────────────────────────────────────────────────────────────

interface DockerContainer {
  id:      string;
  name:    string;
  image:   string;
  status:  string;
  ports?:  string;
  cpu?:    number;
  memory?: number;
  state?:  string; 
  memMb?:  number; 
  created?: string;
}

interface EnrichedServer extends Server {
  containers?:   DockerContainer[];
  topProcesses?: any[];
  metrics: Server["metrics"] & {
    ramUsedPct?: number;
    cpuCores?:   number;
    cpuPerCore?: number[];
    loadAvg?:    number[];
    hostname?:   string;
    os?:         string;
    kernel?:     string;
    agentVersion?: string;
    uptimeSeconds?: number;
    bootTime?: string;
    isStale?: boolean;
    lastSeen?: string;
    network?: {
      interfaces: any[];
      tcpEstablished: number;
    };
    partitions?: any[];
    topProcesses?: any[];
  } | null;
}

const ENV_ORDER: Environment[]   = ["Dev", "Demo", "Pilote", "Prod", "Backup"];
const DISK_ALERT = 80;

const PROVIDER_COLORS: Record<Provider, string> = {
  OVH:   "#5b8def",
  Azure: "#4ba3d9",
  AWS:   "#e08a4a",
};

const ENV_COLORS: Record<Environment, string> = {
  Dev:    "#5bb8cf",
  Demo:   "#9585d3",
  Pilote: "#d4a843",
  Prod:   "#4dab8a",
  Backup: "#8891a0",
};

const ENV_DESC: Record<Environment, string> = {
  Dev:    "Développement & intégration continue",
  Demo:   "Démonstrations & formations clients",
  Pilote: "Validation métier grandeur réelle",
  Prod:   "Production — applications critiques",
  Backup: "Sauvegardes & images systèmes",
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function diskColor(pct: number): string {
  if (pct >= 85) return "#d95565";
  if (pct >= 75) return "#d4a843";
  if (pct >= 55) return "#5b8def";
  return "#4dab8a";
}

function fmtGb(gb: number | undefined | null): string {
  if (gb == null || gb === 0) return "—";
  if (gb >= 1024) return `${(gb / 1024).toFixed(1)} To`;
  return `${gb} Go`;
}

function fmtUptime(h: number | undefined | null): string {
  if (!h) return "—";
  if (h < 24)  return `${Math.round(h)}h`;
  if (h < 720) return `${Math.floor(h / 24)}j ${Math.round(h % 24)}h`;
  return `${Math.floor(h / 720)}mois`;
}

function projectTypeColor(type?: string): string {
  switch (type) {
    case "app":    return "#5b8def";
    case "api":    return "#5bb8cf";
    case "db":     return "#9585d3";
    case "worker": return "#d4a843";
    default:       return "#8891a0";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function MetricGauge({ pct, color, label, t }: { pct: number; color: string; label: string; t: any }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: t.textFaint, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 800, color, fontFamily: "'JetBrains Mono',monospace" }}>{pct}%</span>
      </div>
      <div style={{ height: 7, background: t.diskBg, borderRadius: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

function StatusPulse({ status, active }: { status: string; active: boolean }) {
  const c = active ? "#4dab8a" : status === "unknown" ? "#8891a0" : "#d95565";
  const shouldPulse = active;
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ position: "absolute", width: 22, height: 22, borderRadius: "50%", background: c, opacity: 0.3, animation: shouldPulse ? "ping 1.5s cubic-bezier(0,0,.2,1) infinite" : "none" }} />
      <span style={{ width: 12, height: 12, borderRadius: "50%", background: c, display: "block", position: "relative" }} />
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVER CARD — vue kanban
// ─────────────────────────────────────────────────────────────────────────────

function ServerCard({ s, onClick, dark, onDelete, statusSince }: { s: EnrichedServer; onClick: () => void; dark: boolean; onDelete: (e: React.MouseEvent) => void; statusSince: string }) {
  const t = useTokens(dark);
  const m = s.metrics;
  const pColor = PROVIDER_COLORS[s.provider];
  const diskPct = m?.diskUsedPct ?? 0;
  const isAlert = diskPct >= DISK_ALERT;
  const projects = Array.isArray(s.projects) ? s.projects : [];
  const containers = Array.isArray(s.containers) ? s.containers : [];
  const stoppedContainers = containers.filter((c: any) => typeof c.status === "string" && /^Exited\b/i.test(c.status)).length;
  const runningContainers = containers.filter((c: any) => typeof c.status === "string" && /^Up\b/i.test(c.status)).length;

  return (
    <div
      onClick={onClick}
      style={{
        background:   t.surface,
        border:       `1px solid ${!s.agentActive ? "#d95565" : isAlert ? "#d9556544" : t.border}`,
        borderRadius: 14,
        padding:      "20px 22px",
        cursor:       "pointer",
        transition:   "all 0.18s ease",
        position:     "relative",
        overflow:     "hidden",
        filter:       !s.agentActive ? "grayscale(0.6) opacity(0.8)" : "none",
        animation:    !s.agentActive ? "borderPulse 2s infinite" : "none",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isAlert ? "#d9556588" : "#5b8def";
        (e.currentTarget as HTMLDivElement).style.transform   = "translateY(-2px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow   = dark ? "0 8px 24px rgba(0,0,0,0.3)" : "0 8px 24px rgba(59,130,246,0.12)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.borderColor = isAlert ? "#d9556544" : t.border;
        (e.currentTarget as HTMLDivElement).style.transform   = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow   = "none";
      }}
    >
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: pColor, borderRadius: "14px 14px 0 0" }} />

      {/* Row 1: provider badge + delete/status */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, padding: "3px 10px", borderRadius: 20, background: pColor + "18", color: pColor, border: `1px solid ${pColor}33`, fontFamily: "'JetBrains Mono',monospace" }}>
          {s.provider}
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isAlert && (
            <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "#d9556518", color: "#d95565", border: "1px solid #d9556533", display:"inline-flex", alignItems:"center", gap:3 }}><AlertTriangle size={12} /></span>
          )}
          <button onClick={onDelete} style={{ background:"none", border:"none", color:t.textFaint, cursor:"pointer", padding:0 }} onMouseEnter={e => e.currentTarget.style.color="#d95565"} onMouseLeave={e => e.currentTarget.style.color=t.textFaint}>
            <Trash2 size={15} />
          </button>
          <StatusPulse status={m ? (s.agentActive ? m.status : "offline") : "unknown"} active={s.agentActive} />
        </div>
      </div>

      {/* Row 2: server name + duration (full width) */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: t.text, letterSpacing: "-0.2px", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
        <StatusDuration since={statusSince} active={s.agentActive} t={t} />
      </div>

      {/* Row 3: IP */}
      <div style={{ fontSize: 13, color: t.textMuted, fontFamily: "'JetBrains Mono',monospace", marginBottom: 14 }}>{s.ip}</div>

      {m ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
          <MetricGauge pct={diskPct}              color={diskColor(diskPct)} label="Disque" t={t} />
          <MetricGauge pct={m.ramUsedPct ?? Math.round((m.ramUsedGb / m.ramTotalGb) * 100)} color={(m.ramUsedPct ?? (m.ramUsedGb / m.ramTotalGb) * 100) > 85 ? "#d95565" : "#9585d3"} label="RAM" t={t} />
          <MetricGauge pct={m.cpuLoadPct}         color={m.cpuLoadPct > 80 ? "#d95565" : "#5bb8cf"} label="CPU" t={t} />
        </div>
      ) : (
        <div style={{ padding: "14px 0", textAlign: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 13, color: t.textFaint, fontStyle: "italic" }}>Agent non connecté</div>
        </div>
      )}

      {/* Temps relatif */}
      {/* <div style={{ marginBottom: 8 }}>
        <RelativeTime date={m?.createdAt} active={s.agentActive} />
      </div> */}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {m && (
          <>
            <span style={{ fontSize: 12, color: t.textMuted, background: t.surfaceAlt, border: `1px solid ${t.border}`, padding: "4px 10px", borderRadius: 8, fontFamily: "'JetBrains Mono',monospace" }}>
              {fmtGb(m.diskFreeGb)} libres
            </span>
          </>
        )}
        {projects.length > 0 && (
          <span style={{ fontSize: 12, color: "#5b8def", background: "#5b8def10", border: "1px solid #5b8def25", padding: "4px 10px", borderRadius: 8, fontWeight: 600 }}>
            {projects.length} projet{projects.length > 1 ? "s" : ""}
          </span>
        )}
        {stoppedContainers > 0 && (
          <span style={{ fontSize: 12, color: "#d4a843", background: "#d4a84310", border: "1px solid #d4a84325", padding: "4px 10px", borderRadius: 8, fontWeight: 600 }}>
            {stoppedContainers} arret.
          </span>
        )}
        {runningContainers > 0 && (
          <span style={{ fontSize: 12, color: "#4dab8a", background: "#4dab8a10", border: "1px solid #4dab8a25", padding: "4px 10px", borderRadius: 8, fontWeight: 600 }}>
            {runningContainers} actif{runningContainers > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <style>{`
        @keyframes ping{75%,100%{transform:scale(2);opacity:0}}
        @keyframes borderPulse {
          0% { border-color: #d9556588; box-shadow: 0 0 0px #d9556500; }
          50% { border-color: #d95565; box-shadow: 0 0 10px #d9556533; }
          100% { border-color: #d9556588; box-shadow: 0 0 0px #d9556500; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ServerDrawer({ s, onClose, dark, onUpdate }: { s: EnrichedServer; onClose: () => void; dark: boolean; onUpdate: () => void }) {
  const t = useTokens(dark);
  const m = s.metrics;
  const pColor = PROVIDER_COLORS[s.provider];
  const [tab, setTab] = useState<"overview" | "projects" | "docker" | "system">("overview");
  const [showAddProject, setShowAddProject] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [containerLogsModal, setContainerLogsModal] = useState<string | null>(null);

  const projects = Array.isArray(s.projects) ? s.projects : [];
  const containers = (Array.isArray(s.containers) ? s.containers : (s.containers as any)?.containers || []);
  const topProcesses = (Array.isArray(s.topProcesses) ? s.topProcesses : (s.topProcesses as any)?.processes || []);

  const diskPct  = m?.diskUsedPct ?? 0;
  const ramPct   = m ? Math.round(((m.ramUsedPct ?? 0) || (m.ramUsedGb / m.ramTotalGb) * 100)) : 0;
  const cpuPct   = m?.cpuLoadPct ?? 0;

  const TABS = [
    { id: "overview" as const, label: "Vue générale",   icon: <Monitor size={14} /> },
    { id: "projects" as const, label: `Déploiements (${projects.length})`, icon: <Rocket size={14} /> },
    { id: "docker"   as const, label: `Docker (${containers.length})`,     icon: <Box size={14} /> },
    { id: "system"   as const, label: "Processus & Système", icon: <Settings size={14} /> },
  ];

  const deleteProject = async () => {
    if (projectToDelete === null) return;
    try {
      const res = await apiFetch(`/api/servers/${s.id}/projects`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectToDelete })
      });
      if (res.ok) {
        onUpdate();
      }
    } catch (e) { console.error(e); }
    finally { setProjectToDelete(null); }
  };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, backdropFilter: "blur(2px)" }} />

      <div style={{
          position:     "fixed",
          top:          0,
          right:        0,
          bottom:       0,
          width:        740,
          maxWidth:     "95vw",
          background:   dark ? "#0f1117" : "#f4f6f9",
          borderLeft:   `1px solid ${t.borderMid}`,
          zIndex:       300,
          display:      "flex",
          flexDirection: "column",
          animation:    "slideIn 0.22s cubic-bezier(0.16,1,0.3,1)",
          boxShadow:    "-10px 0 30px rgba(0,0,0,0.2)",
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(100%); opacity:0.6; } to { transform: translateX(0); opacity:1; } }`}</style>

        <div style={{ padding: "20px 24px 0", borderBottom: `1px solid ${t.border}`, background: dark ? "#16181e" : "#ffffff", position: "sticky", top: 0, zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: pColor + "18", border: `1px solid ${pColor}33`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ServerIcon size={18} color={pColor} strokeWidth={2.5} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: t.text }}>{s.name}</div>
                  <div style={{ fontSize: 12, color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{s.ip}</div>
                </div>
              </div>
            </div>
            <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.border}`, background: t.surfaceAlt, color: t.textMuted, cursor: "pointer" }}><X size={18} /></button>
          </div>

          <div style={{ display: "flex", gap: 2, marginBottom: -1 }}>
            {TABS.map(tb => (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                style={{
                  padding: "8px 14px", border: "none", borderBottom: `2px solid ${tab === tb.id ? pColor : "transparent"}`,
                  background: "none", color: tab === tb.id ? pColor : t.textMuted, fontSize: 12, fontWeight: tab === tb.id ? 700 : 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {tb.icon} {tb.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "24px", flex: 1, overflowY: "auto" }}>
          {s.agentActive === false && m?.isStale && (
            <div style={{ background: "#d9556515", border: "1px solid #d9556533", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#d9556518", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Filter size={18} color="#d95565" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#d95565" }}>Serveur Hors Ligne</div>
                <div style={{ fontSize: 11, color: t.textMuted }}>Données figées du {new Date(m.lastSeen || "").toLocaleString()}</div>
              </div>
              <span style={{ fontSize: 9, fontWeight: 800, padding: "2px 6px", borderRadius: 4, background: "#d95565", color: "#fff" }}>STALE</span>
            </div>
          )}

          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!m ? (
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "32px", textAlign: "center" }}>
                   <Monitor size={48} color={t.textFaint} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>Agent non connecté</div>
                  <div style={{ fontSize: 11, background: t.surfaceAlt, borderRadius: 8, padding: "10px", color: "#4dab8a", fontFamily: "'JetBrains Mono',monospace" }}>
                    curl -sSL https://get.nebulops.io/agent | sudo bash
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "20px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", marginBottom: 14 }}>Ressources Principales</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <MetricGauge pct={diskPct} color={diskColor(diskPct)} label={`Disque — ${fmtGb(m.diskUsedGb)} / ${fmtGb(m.diskTotalGb)}`} t={t} />
                      <MetricGauge pct={ramPct}  color={ramPct > 85 ? "#d95565" : "#9585d3"} label={`RAM — ${fmtGb(m.ramUsedGb)} / ${fmtGb(m.ramTotalGb)}`} t={t} />
                      <MetricGauge pct={cpuPct}  color={cpuPct > 80 ? "#d95565" : "#5bb8cf"} label="CPU Global" t={t} />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                    {[
                      { l: "Uptime", v: fmtUptime(m.uptimeHours) },
                      { l: "TCP Actifs", v: m.network?.tcpEstablished || "—" },
                      { l: "Agent", v: `v${m.agentVersion || '1.0'}` },
                    ].map(k => (
                      <div key={k.l} style={{ background: t.surfaceAlt, borderRadius: 10, padding: "12px" }}>
                        <div style={{ fontSize: 10, color: t.textFaint, fontWeight: 700, textTransform: "uppercase", marginBottom: 5 }}>{k.l}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {tab === "projects" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <div style={{ fontSize: 12, color: t.textMuted }}>{projects.length} projet(s) déployé(s) manuellement</div>
                <button 
                  onClick={() => setShowAddProject(true)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8, border: "none", background: "#5b8def", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(59,130,246,0.3)" }}
                >
                  <Plus size={14} /> Ajouter un projet
                </button>
              </div>

              {projects.length === 0 ? (
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "40px", textAlign: "center" }}>
                   <Rocket size={48} color={t.textFaint} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 13, color: t.textMuted }}>Aucun projet manuel sur ce serveur.</div>
                </div>
              ) : (
                projects.map(p => (
                  <div key={p.id} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: "#5b8def18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                       <Rocket size={18} color="#5b8def" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: t.text }}>{p.name}</div>
                      <div style={{ fontSize: 10, color: t.textFaint }}>ID: {p.id}</div>
                    </div>
                    <button onClick={() => setProjectToDelete(p.id)} style={{ background:"none", border:"none", color:t.textFaint, cursor:"pointer" }} onMouseEnter={e => e.currentTarget.style.color="#d95565"} onMouseLeave={e => e.currentTarget.style.color=t.textFaint}>
                       <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}

              {showAddProject && (
                <AddProjectModal 
                  serverId={s.id} 
                  onClose={() => setShowAddProject(false)} 
                  onAdd={onUpdate} 
                  dark={dark} 
                />
              )}
            </div>
          )}

          {tab === "docker" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {containers.length === 0 ? (
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "40px", textAlign: "center" }}>
                  <Box size={48} color={t.textFaint} style={{ marginBottom: 12 }} />
                  <div style={{ fontSize: 13, color: t.textMuted }}>Pas de containers détectés.</div>
                </div>
              ) : (
                containers.map((c: any) => (
                  <div key={c.id} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: t.surfaceAlt, padding: "12px 16px", borderBottom: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: (c.state === "running" || /^Up\b/i.test(c.status || "")) ? "#4dab8a" : "#d95565" }} />
                        <div style={{ fontSize: 14, fontWeight: 800, color: t.text }}>{c.name}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ fontSize: 11, color: t.textFaint }}>{c.id.substring(0, 12)}</div>
                        <button
                          onClick={() => setContainerLogsModal(c.name)}
                          style={{
                            display: "flex", alignItems: "center", gap: 5,
                            padding: "4px 10px", borderRadius: 6, border: `1px solid ${t.border}`,
                            background: "transparent", color: t.textMuted, cursor: "pointer",
                            fontSize: 11, fontWeight: 700,
                          }}
                        >
                          <FileText size={11} /> Logs
                        </button>
                      </div>
                    </div>
                    <div style={{ padding: "16px", fontSize: 12 }}>
                        <div><span style={{ color: t.textFaint }}>Image:</span> {c.image}</div>
                        <div><span style={{ color: t.textFaint }}>Status:</span> {c.status}</div>
                        {c.ports && <div><span style={{ color: t.textFaint }}>Ports:</span> {c.ports}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "system" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Top Processus</div>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: t.surfaceAlt, borderBottom: `1px solid ${t.border}` }}>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: t.textFaint }}>PID</th>
                        <th style={{ padding: "8px 12px", textAlign: "left", fontSize: 10, color: t.textFaint }}>NOM</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, color: t.textFaint }}>CPU %</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", fontSize: 10, color: t.textFaint }}>RAM %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProcesses.map((p: any) => (
                        <tr key={p.pid} style={{ borderBottom: `1px solid ${t.border}` }}>
                          <td style={{ padding: "8px 12px", fontSize: 11, color: t.textMuted }}>{p.pid}</td>
                          <td style={{ padding: "8px 12px", fontSize: 11, fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: "8px 12px", fontSize: 11, textAlign: "right" }}>{p.cpu}%</td>
                          <td style={{ padding: "8px 12px", fontSize: 11, textAlign: "right" }}>{p.ram}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Services Localisés</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                  {(m as any)?.services?.map((svc: any) => (
                    <div key={svc.name} style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: svc.status === "running" ? "#4dab8a" : "#d95565" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: t.text }}>{svc.name}</div>
                        <div style={{ fontSize: 9, color: t.textMuted, textTransform: "uppercase" }}>{svc.status}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Informations Système</div>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 20px" }}>
                  {[
                    { l: "Hostname", v: (m as any)?.hostname || "—" },
                    { l: "OS", v: (m as any)?.os || "—" },
                    { l: "Kernel", v: (m as any)?.kernel || "—" },
                    { l: "Dernière synchro", v: m?.lastSeen ? new Date(m.lastSeen).toLocaleString() : "Jamais" },
                    { l: "IP Principale", v: s.ip },
                  ].map((row, i, arr) => (
                    <div key={row.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${t.border}` : "none" }}>
                      <span style={{ fontSize: 11, color: t.textFaint, fontWeight: 700, textTransform: "uppercase" }}>{row.l}</span>
                      <span style={{ fontSize: 12, color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>{row.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal logs d'un container ── */}
      {containerLogsModal && (
        <>
          <div
            onClick={() => setContainerLogsModal(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 400, backdropFilter: "blur(3px)" }}
          />
          <div style={{
            position: "fixed", top: "5vh", left: "50%", transform: "translateX(-50%)",
            width: "min(780px, 94vw)", maxHeight: "88vh",
            background: dark ? "#0f1117" : "#f4f6f9",
            border: `1px solid ${t.borderMid}`,
            borderRadius: 16, zIndex: 500,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "16px 20px", borderBottom: `1px solid ${t.border}`,
              background: dark ? "#13161f" : "#fff", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: "#2496ed18", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <FileText size={15} color="#2496ed" />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: t.text }}>
                    Logs — {containerLogsModal}
                  </div>
                  <div style={{ fontSize: 11, color: t.textFaint }}>{s.name} · {s.ip}</div>
                </div>
              </div>
              <button
                onClick={() => setContainerLogsModal(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: t.textFaint, padding: 4 }}
              >
                <X size={18} />
              </button>
            </div>
            {/* Corps */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px" }}>
              <LogsPanel dark={dark} serverId={s.id} containerName={containerLogsModal} />
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE PRINCIPALE
// ─────────────────────────────────────────────────────────────────────────────

export default function ServersPage() {
  const { dark, servers, fetchServers, showToast, isInitialLoading } = useAppStore();
  const t = useTokens(dark);
  const searchParams = useSearchParams();

  const [selected, setSelected] = useState<EnrichedServer | null>(null);
  const [search,   setSearch]   = useState("");
  const [filterProv, setFilterProv] = useState<Provider | "All">("All");
  const [filterProj, setFilterProj] = useState<number | "All">("All");
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [serverToDelete, setServerToDelete] = useState<Server | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const allProjects = useMemo(() => {
    const projMap = new Map<number, Project>();
    servers.forEach(s => s.projects?.forEach(p => projMap.set(p.id, p)));
    return Array.from(projMap.values()).sort((a,b) => a.name.localeCompare(b.name));
  }, [servers]);

  const filtered = useMemo(() => servers.filter((s: Server) => {
    const enriched = s as EnrichedServer;
    if (filterProv !== "All" && enriched.provider !== filterProv) return false;
    if (filterProj !== "All" && !enriched.projects?.some(p => p.id === filterProj)) return false;
    if (search) {
      const low = search.toLowerCase();
      const matchProject = enriched.projects?.some(p => p.name.toLowerCase().includes(low));
      return enriched.name.toLowerCase().includes(low) || enriched.ip.includes(search) || matchProject;
    }
    return true;
  }), [servers, filterProv, filterProj, search]);

  const paginatedList = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  const byEnv = useMemo(() => {
    const map: Record<Environment, EnrichedServer[]> = { Dev: [], Demo: [], Pilote: [], Prod: [], Backup: [] };
    paginatedList.forEach((s: Server) => { if (map[s.environment]) map[s.environment].push(s as EnrichedServer); });
    return map;
  }, [paginatedList]);

  const serverMeta: PaginationMeta = useMemo(() => {
    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / limit);
    return {
      totalItems,
      itemCount: Math.min(limit, totalItems - (page - 1) * limit),
      itemsPerPage: limit,
      totalPages: Math.max(1, totalPages),
      currentPage: page,
      nextPage: page < totalPages ? page + 1 : null,
      previousPage: page > 1 ? page - 1 : null,
    };
  }, [filtered, page, limit]);

  // Reset page when search or filters change
  useEffect(() => {
    setPage(1);
  }, [search, filterProv, filterProj]);

  // Auto-open drawer when ?serverId=X is in URL (e.g. from dashboard KPI click)
  const openServerIdRef = useRef<string | null>(null);
  useEffect(() => {
    const serverId = searchParams.get("serverId");
    if (serverId && serverId !== openServerIdRef.current && servers.length > 0) {
      openServerIdRef.current = serverId;
      const target = servers.find(s => s.id === Number(serverId));
      if (target) setSelected(target as EnrichedServer);
    }
  }, [searchParams, servers]);

  useEffect(() => {
    if (selected) {
      const updated = servers.find(s => s.id === selected.id);
      if (updated) setSelected(updated as EnrichedServer);
    }
  }, [servers]);

  const handleDeleteServer = async () => {
    if (!serverToDelete) return;
    try {
      const res = await apiFetch(`/api/servers/${serverToDelete.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Serveur "${serverToDelete.name}" supprimé`);
        fetchServers();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setServerToDelete(null);
    }
  };

  if (isInitialLoading) return <DashboardLoading />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: t.text, marginBottom: 4 }}>Parc serveurs</h1>
          <p style={{ fontSize: 14, color: t.textMuted }}>Gestion centralisée des actifs réseau</p>
        </div>
        <button
          style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "#5b8def", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}
          onClick={() => setShowAdd(true)}
        >
          <Plus size={16} /> Ajouter un serveur
        </button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: t.surface, padding: "12px", borderRadius: "12px", border: `1px solid ${t.border}` }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textFaint }}><Search size={14} /></span>
          <input 
            style={{ width: "100%", background: t.surfaceAlt, border: `1px solid ${t.borderMid}`, borderRadius: 9, padding: "10px 13px 10px 34px", color: t.text, fontSize: 14, outline: "none" }} 
            placeholder="Rechercher par nom ou IP..." value={search} onChange={e => setSearch(e.target.value)} 
          />
        </div>

        {/* Provider Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select 
            value={filterProv} 
            onChange={e => setFilterProv(e.target.value as any)}
            style={{ 
              background: t.surfaceAlt, border: `1px solid ${t.borderMid}`, borderRadius: 9, 
              padding: "10px 12px", color: t.text, fontSize: 14, outline: "none", cursor: "pointer",
              minWidth: "160px"
            }}
          >
            <option value="All">Tous les hébergeurs</option>
            <option value="OVH">OVH Cloud</option>
            <option value="Azure">Microsoft Azure</option>
            <option value="AWS">Amazon Web Services</option>
          </select>
        </div>

        {/* Project Filter */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <select 
            value={filterProj} 
            onChange={e => setFilterProj(e.target.value === "All" ? "All" : Number(e.target.value))}
            style={{ 
              background: t.surfaceAlt, border: `1px solid ${t.borderMid}`, borderRadius: 9, 
              padding: "9px 12px", color: t.text, fontSize: 13, outline: "none", cursor: "pointer",
              minWidth: "160px"
            }}
          >
            <option value="All">Tous les projets</option>
            {allProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* View Toggle */}
        <div style={{ display: "flex", background: t.surfaceAlt, padding: "3px", borderRadius: "10px", border: `1px solid ${t.borderMid}` }}>
          {[
            { id: "kanban", icon: LayoutGrid, label: "Kanban" },
            { id: "list",   icon: ListIcon,  label: "Liste" },
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id as any)}
              style={{
                display: "flex", alignItems: "center", gap: "6px", padding: "6px 14px",
                borderRadius: "8px", border: "none", cursor: "pointer",
                background: viewMode === m.id ? t.surface : "transparent",
                color: viewMode === m.id ? t.text : t.textMuted,
                fontSize: "14px", fontWeight: viewMode === m.id ? 700 : 500,
                transition: "all 0.15s",
                boxShadow: viewMode === m.id ? "0 2px 6px rgba(0,0,0,0.1)" : "none",
              }}
            >
              <m.icon size={14} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div style={{ display: "flex", gap: 18, overflowX: "auto", paddingBottom: 12 }}>
          {ENV_ORDER.map(env => {
            const envServers = byEnv[env] ?? [];
            return (
              <div key={env} style={{ flexShrink: 0, width: 340, display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, padding: "12px 16px", display:"flex", alignItems:"center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: ENV_COLORS[env] }} />
                  <span style={{ fontSize: 15, fontWeight: 800, color: t.text }}>{env} ({envServers.length})</span>
                </div>
                {envServers.map(s => {
                  const currentStatus = s.agentActive ? (s.metrics?.status || "online") : "offline";
                  return (
                    <ServerCard
                      key={s.id}
                      s={s}
                      statusSince={s.statusLastChangedAt as any}
                      dark={dark}
                      onClick={() => setSelected(s)}
                      onDelete={(e) => { e.stopPropagation(); setServerToDelete(s); }}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div style={{ background: t.surface, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: t.surfaceAlt, borderBottom: `1px solid ${t.border}` }}>
                {["Statut", "IP & Nom", "Hébergeur", "Env", "Disque", "RAM", "CPU", "Actions"].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 12, color: t.textFaint, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedList.map((s, i) => {
                const m = s.metrics;
                const currentStatus = s.agentActive ? (m?.status || "online") : "offline";
                const diskPct = m?.diskUsedPct ?? 0;
                const ramPct = m ? (m.ramUsedPct ?? Math.round((m.ramUsedGb / m.ramTotalGb) * 100)) : 0;
                const cpuPct = m?.cpuLoadPct ?? 0;

                return (
                  <tr key={s.id}
                    onClick={() => setSelected(s)}
                    style={{ borderBottom: i < filtered.length - 1 ? `1px solid ${t.border}` : "none", cursor: "pointer", transition: "all 0.1s" }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = dark ? "rgba(59,130,246,0.03)" : "rgba(59,130,246,0.02)"}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <StatusPulse status={m ? (s.agentActive ? m.status : "offline") : "unknown"} active={s.agentActive} />
                        <StatusDuration since={s.statusLastChangedAt} active={s.agentActive} t={t} />
                      </div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: t.textMuted, fontFamily: "'JetBrains Mono',monospace" }}>{s.ip}</div>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: PROVIDER_COLORS[s.provider] + "18", color: PROVIDER_COLORS[s.provider], border: `1px solid ${PROVIDER_COLORS[s.provider]}33` }}>
                        {s.provider}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: ENV_COLORS[s.environment] + "18", color: ENV_COLORS[s.environment], border: `1px solid ${ENV_COLORS[s.environment]}33` }}>
                        {s.environment}
                      </span>
                    </td>
                    <td style={{ padding: "14px 16px", minWidth: 120 }}>
                      {m ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: t.diskBg, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${diskPct}%`, background: diskColor(diskPct) }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: diskColor(diskPct), fontFamily: "'JetBrains Mono',monospace", width: 34 }}>{diskPct}%</span>
                        </div>
                      ) : <span style={{ color: t.textFaint, fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 16px", minWidth: 120 }}>
                      {m ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: t.diskBg, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${ramPct}%`, background: ramPct > 85 ? "#d95565" : "#9585d3" }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: t.text, fontFamily: "'JetBrains Mono',monospace", width: 34 }}>{ramPct}%</span>
                        </div>
                      ) : <span style={{ color: t.textFaint, fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 16px", minWidth: 120 }}>
                      {m ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 4, background: t.diskBg, borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${cpuPct}%`, background: cpuPct > 80 ? "#d95565" : "#5bb8cf" }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: t.text, fontFamily: "'JetBrains Mono',monospace", width: 34 }}>{cpuPct}%</span>
                        </div>
                      ) : <span style={{ color: t.textFaint, fontSize: 11 }}>—</span>}
                    </td>
                    <td style={{ padding: "14px 16px" }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); setServerToDelete(s); }} 
                        style={{ background:"none", border:"none", color:t.textFaint, cursor:"pointer", padding:8 }} 
                        onMouseEnter={e => e.currentTarget.style.color="#d95565"} 
                        onMouseLeave={e => e.currentTarget.style.color=t.textFaint}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px", fontSize: 13, color: t.textFaint }}>
              Aucun serveur ne correspond à votre recherche.
            </div>
          )}
        </div>
      )}

      <Pagination meta={serverMeta} onPageChange={setPage} onLimitChange={setLimit} t={t} />

      {selected && <ServerDrawer s={selected} onClose={() => setSelected(null)} dark={dark} onUpdate={fetchServers} />}

      {showAdd && <AddServerModal onClose={() => setShowAdd(false)} onAdd={fetchServers} dark={dark} />}

      <ConfirmModal
        isOpen={serverToDelete !== null}
        onClose={() => setServerToDelete(null)}
        onConfirm={handleDeleteServer}
        title="Supprimer le serveur ?"
        message={`Voulez-vous vraiment supprimer "${serverToDelete?.name}" ?`}
        confirmText="Supprimer"
        variant="danger"
      />
    </div>
  );
}
