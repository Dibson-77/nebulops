"use client";

/**
 * components/dashboard/LogsPanel.tsx
 * ────────────────────────────────────
 * Composant partagé utilisé :
 *  - sur la page /logs (serverId = undefined → tous les serveurs)
 *  - dans ServerDetailModal (serverId = server.id → logs d'un seul serveur)
 */

import { useState, useEffect, useCallback } from "react";
import { useTokens } from "@/hooks/use-tokens";
import { apiFetch } from "@/lib/api-client";
import { Pagination } from "@/shared/components/molecules/Pagination";
import type { ServerLog, IPaginationResult, LogLevel, LogSource } from "@/types";
import {
  AlertTriangle, AlertOctagon, Info, ChevronDown, ChevronUp,
  CheckCircle2, RotateCcw, Trash2, Copy, Filter, Search,
} from "lucide-react";

// ─── Constantes ───────────────────────────────────────────────────────────────

const LEVEL_META: Record<LogLevel, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  WARN:  { label: "WARN",  color: "#d4a843", bg: "#d4a84320", icon: Info },
  ERROR: { label: "ERROR", color: "#e57c40", bg: "#e57c4020", icon: AlertTriangle },
  FATAL: { label: "FATAL", color: "#d95565", bg: "#d9556520", icon: AlertOctagon },
};

const SOURCE_META: Record<LogSource, { label: string; color: string }> = {
  DOCKER:  { label: "Docker",  color: "#2496ed" },
  SYSTEM:  { label: "System",  color: "#8891a0" },
  WEBHOOK: { label: "Webhook", color: "#9b59b6" },
};

// ─── Sous-composants ──────────────────────────────────────────────────────────

function LevelBadge({ level, t }: { level: LogLevel; t: any }) {
  const meta = LEVEL_META[level] ?? LEVEL_META.ERROR;
  const Icon = meta.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "4px",
      padding: "2px 8px", borderRadius: "6px",
      background: meta.bg, color: meta.color,
      fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em",
      fontFamily: "'JetBrains Mono', monospace",
    }}>
      <Icon size={11} strokeWidth={2.5} /> {meta.label}
    </span>
  );
}

function SourceBadge({ source }: { source: LogSource }) {
  const meta = SOURCE_META[source] ?? { label: source, color: "#8891a0" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 7px", borderRadius: "5px",
      background: `${meta.color}18`, color: meta.color,
      fontSize: "11px", fontWeight: 700,
    }}>
      {meta.label}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "à l'instant";
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

// ─── LogRow ──────────────────────────────────────────────────────────────────

function LogRow({ log, dark, onResolve, onDelete }: {
  log: ServerLog;
  dark: boolean;
  onResolve: (id: number, resolved: boolean) => void;
  onDelete: (id: number) => void;
}) {
  const t = useTokens(dark);
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);

  const handleResolve = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setActing(true);
    try {
      const res = await apiFetch(`/api/logs/${log.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isResolved: !log.isResolved }),
      });
      if (res.ok) onResolve(log.id, !log.isResolved);
    } finally { setActing(false); }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Supprimer ce log ?")) return;
    setActing(true);
    try {
      const res = await apiFetch(`/api/logs/${log.id}`, { method: "DELETE" });
      if (res.ok) onDelete(log.id);
    } finally { setActing(false); }
  };

  const copyStack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (log.stackTrace) navigator.clipboard.writeText(log.stackTrace);
  };

  const borderLeft = log.isResolved ? `3px solid ${t.border}` : `3px solid ${LEVEL_META[log.level]?.color ?? "#e57c40"}`;

  return (
    <div
      onClick={() => setExpanded(v => !v)}
      style={{
        borderLeft,
        background: expanded ? t.surfaceAlt : t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: "10px",
        marginBottom: "8px",
        cursor: "pointer",
        opacity: log.isResolved ? 0.6 : 1,
        transition: "all 0.15s",
      }}
    >
      {/* ── Ligne principale ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 14px" }}>
        <LevelBadge level={log.level} t={t} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: "14px", fontWeight: 600, color: t.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {log.message}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap", alignItems: "center" }}>
            <SourceBadge source={log.source} />
            {log.containerName && (
              <span style={{ fontSize: "12px", color: t.textFaint, fontFamily: "'JetBrains Mono', monospace" }}>
                {log.containerName}
              </span>
            )}
            {log.serviceName && (
              <span style={{ fontSize: "12px", color: t.textFaint }}>
                {log.serviceName}
              </span>
            )}
            {log.server && (
              <span style={{ fontSize: "12px", color: t.textFaint }}>
                {log.server.name}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
          {log.occurrences > 1 && (
            <span style={{
              background: "#5b8def20", color: "#5b8def",
              fontSize: "11px", fontWeight: 800, padding: "2px 8px",
              borderRadius: "10px", fontFamily: "'JetBrains Mono', monospace",
            }}>
              ×{log.occurrences}
            </span>
          )}
          <span style={{ fontSize: "12px", color: t.textFaint }}>{timeAgo(log.lastSeenAt)}</span>
          {expanded ? <ChevronUp size={16} color={t.textFaint} /> : <ChevronDown size={16} color={t.textFaint} />}
        </div>
      </div>

      {/* ── Détail expandable ── */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "14px 16px" }} onClick={e => e.stopPropagation()}>
          {log.stackTrace && (
            <div style={{ marginBottom: "14px" }}>
              <div style={{ fontSize: "12px", fontWeight: 700, color: t.textFaint, marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Stack trace
              </div>
              <pre style={{
                background: dark ? "#0d0f14" : "#f4f6fb",
                border: `1px solid ${t.border}`, borderRadius: "8px",
                padding: "12px", fontSize: "12px", color: t.text,
                fontFamily: "'JetBrains Mono', monospace",
                overflow: "auto", maxHeight: "220px", lineHeight: 1.6,
                whiteSpace: "pre-wrap", wordBreak: "break-all",
              }}>
                {log.stackTrace}
              </pre>
            </div>
          )}

          <div style={{ fontSize: "12px", color: t.textFaint, marginBottom: "12px" }}>
            Première occurrence : {new Date(log.createdAt).toLocaleString("fr-FR")}
            {log.occurrences > 1 && ` · Dernière : ${new Date(log.lastSeenAt).toLocaleString("fr-FR")}`}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              disabled={acting}
              onClick={handleResolve}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                background: log.isResolved ? "#4dab8a20" : "#4dab8a",
                color: log.isResolved ? "#4dab8a" : "#fff",
                fontSize: "13px", fontWeight: 700,
              }}
            >
              <CheckCircle2 size={14} />
              {log.isResolved ? "Rouvrir" : "Résoudre"}
            </button>

            {log.stackTrace && (
              <button
                onClick={copyStack}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "7px 14px", borderRadius: "8px", cursor: "pointer",
                  border: `1px solid ${t.border}`, background: "transparent",
                  color: t.textMuted, fontSize: "13px", fontWeight: 700,
                }}
              >
                <Copy size={14} /> Copier le stack
              </button>
            )}

            <button
              disabled={acting}
              onClick={handleDelete}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                background: "#d9556520", color: "#d95565",
                fontSize: "13px", fontWeight: 700, marginLeft: "auto",
              }}
            >
              <Trash2 size={14} /> Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LogsPanel (principal) ────────────────────────────────────────────────────

interface LogsPanelProps {
  dark: boolean;
  serverId?: number;      // Si défini → logs du serveur; sinon → tous les logs
  containerName?: string; // Si défini → filtré sur ce container uniquement
}

export function LogsPanel({ dark, serverId, containerName }: LogsPanelProps) {
  const t = useTokens(dark);
  const [logs, setLogs] = useState<ServerLog[]>([]);
  const [meta, setMeta] = useState<IPaginationResult<ServerLog>["metadata"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterResolved, setFilterResolved] = useState("false");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const base = serverId ? `/api/servers/${serverId}/logs` : "/api/logs";
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (search) params.set("search", search);
      if (filterLevel) params.set("level", filterLevel);
      if (filterSource) params.set("source", filterSource);
      if (filterResolved !== "") params.set("isResolved", filterResolved);
      if (containerName) params.set("container", containerName);

      const res = await apiFetch(`${base}?${params}`);
      if (res.ok) {
        const json: IPaginationResult<ServerLog> = await res.json();
        setLogs(json.data);
        setMeta(json.metadata);
      }
    } finally { setLoading(false); }
  }, [serverId, containerName, page, search, filterLevel, filterSource, filterResolved]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Reset page quand les filtres changent
  useEffect(() => { setPage(1); }, [search, filterLevel, filterSource, filterResolved]);

  const handleResolve = (id: number, resolved: boolean) => {
    setLogs(prev => prev.map(l => l.id === id ? { ...l, isResolved: resolved } : l));
  };
  const handleDelete = (id: number) => {
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const selectStyle = {
    padding: "8px 12px", borderRadius: "8px",
    border: `1px solid ${t.borderMid}`, background: t.surface, color: t.text,
    fontSize: "13px", cursor: "pointer", outline: "none",
  };

  return (
    <div>
      {/* ── Barre de filtres ── */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
        {/* Recherche */}
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />
          <input
            placeholder="Rechercher…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px 8px 30px", borderRadius: "8px",
              border: `1px solid ${t.borderMid}`, background: t.surface, color: t.text,
              fontSize: "13px", outline: "none", fontFamily: "inherit",
            }}
          />
        </div>

        <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)} style={selectStyle}>
          <option value="">Tous niveaux</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
          <option value="FATAL">FATAL</option>
        </select>

        <select value={filterSource} onChange={e => setFilterSource(e.target.value)} style={selectStyle}>
          <option value="">Toutes sources</option>
          <option value="DOCKER">Docker</option>
          <option value="SYSTEM">System</option>
          <option value="WEBHOOK">Webhook</option>
        </select>

        <select value={filterResolved} onChange={e => setFilterResolved(e.target.value)} style={selectStyle}>
          <option value="false">Non résolus</option>
          <option value="true">Résolus</option>
          <option value="">Tous</option>
        </select>

        {(search || filterLevel || filterSource) && (
          <button
            onClick={() => { setSearch(""); setFilterLevel(""); setFilterSource(""); }}
            style={{
              padding: "8px 12px", borderRadius: "8px", border: `1px solid ${t.border}`,
              background: "transparent", color: t.textMuted, fontSize: "13px", cursor: "pointer",
            }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* ── Liste des logs ── */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{
              height: "64px", borderRadius: "10px",
              background: dark ? "#1a1d25" : "#f0f2f7", animation: "pulse 1.5s infinite",
            }} />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "48px 24px",
          color: t.textFaint, fontSize: "14px",
        }}>
          <div style={{ fontSize: "32px", marginBottom: "8px" }}>✅</div>
          <div style={{ fontWeight: 700, marginBottom: "4px" }}>Aucun log</div>
          <div>Aucune erreur ne correspond à vos filtres.</div>
        </div>
      ) : (
        <div>
          {logs.map(log => (
            <LogRow
              key={log.id}
              log={log}
              dark={dark}
              onResolve={handleResolve}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {meta && meta.totalPages > 1 && (
        <Pagination
          meta={{
            currentPage: meta.currentPage,
            totalPages: meta.totalPages,
            totalItems: meta.totalItems,
            itemCount: logs.length,
            itemsPerPage: meta.itemsPerPage,
            nextPage: meta.nextPage,
            previousPage: meta.previousPage,
          }}
          onPageChange={setPage}
          t={t}
        />
      )}
    </div>
  );
}
