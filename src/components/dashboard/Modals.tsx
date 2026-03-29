"use client";

import React, { useState, useEffect } from "react";
import { Server, Environment, Provider } from "@/types";
import { useTokens } from "@/hooks/use-tokens";
import { useAppStore } from "@/store/use-app-store";
import { setPauseAutoRefresh } from "@/app/(dashboard)/layout";
import { StatusDot, ProviderBadge, EnvPill } from "./StatusAtoms";
import { formatGb, diskColor } from "@/lib/helpers";
import { ConfirmModal } from "@/shared/components/molecules/ConfirmModal";
import { apiFetch } from "@/lib/api-client";
import { AlertTriangle, BarChart2, FileText } from "lucide-react";
import { LogsPanel } from "./LogsPanel";

const DISK_ALERT_PCT = 80;

export function ServerDetailModal({ server, onClose, dark }: { server: Server; onClose: () => void; dark: boolean }) {
  const t = useTokens(dark);
  const { updateServer, showToast } = useAppStore();
  const m = server.metrics;
  const [newProject, setNewProject] = useState("");
  const [loading, setLoading] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "logs">("overview");

  const addProject = async () => {
    if (!newProject.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/servers/${server.id}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newProject.trim() })
      });
      if (res.ok) {
        const added = await res.json();
        updateServer(server.id, {
          projects: [...(server.projects || []), added]
        });
        showToast(`Projet "${newProject}" ajouté`);
        setNewProject("");
      } else {
        const d = await res.json();
        showToast(d.error || "Erreur lors de l'ajout", "error");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async () => {
    if (projectToDelete === null) return;
    try {
      const res = await apiFetch(`/api/servers/${server.id}/projects`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectToDelete })
      });
      if (res.ok) {
        updateServer(server.id, {
          projects: (server.projects || []).filter(p => p.id !== projectToDelete)
        });
        showToast("Projet supprimé");
      } else {
        showToast("Erreur lors de la suppression", "error");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProjectToDelete(null);
    }
  };
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:t.surface, border:`1px solid ${t.borderMid}`, borderRadius:"14px", padding:"28px 32px", width:"520px", maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto" }}>

        {/* Header */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"18px" }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"4px" }}>
              <StatusDot status={m ? m.status : "unknown"} />
              <span style={{ fontSize:"11px", color:t.textMuted, fontFamily:"'JetBrains Mono',monospace" }}>{server.ip}</span>
              <span style={{ fontSize:"10px", color:t.textFaint }}>port {server.agentPort}</span>
            </div>
            <div style={{ fontSize:"18px", fontWeight:800, color:t.text }}>{server.name}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:t.textMuted, cursor:"pointer", fontSize:"22px", lineHeight:1 }}>×</button>
        </div>

        <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
          <ProviderBadge provider={server.provider} />
          <EnvPill env={server.environment} />
          {m && m.diskUsedPct >= DISK_ALERT_PCT && <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 7px", borderRadius:"4px", background:"#d9556522", color:"#d95565", border:"1px solid #d9556544", display:"inline-flex", alignItems:"center", gap:3 }}><AlertTriangle size={10} /> ALERTE DISQUE</span>}
          {!server.agentActive && <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 7px", borderRadius:"4px", background:"#8891a022", color:"#8891a0", border:"1px solid #8891a044" }}>Agent inactif</span>}
        </div>

        {/* ── Tabs ── */}
        <div style={{ display:"flex", gap:"4px", marginBottom:"18px", background:t.surfaceAlt, padding:"4px", borderRadius:"10px", border:`1px solid ${t.border}` }}>
          {([
            { id:"overview", label:"Vue d'ensemble", icon: BarChart2 },
            { id:"logs",     label:"Logs",           icon: FileText  },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              flex:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"6px",
              padding:"7px 12px", borderRadius:"7px", border:"none", cursor:"pointer",
              background: activeTab === tab.id ? t.surface : "transparent",
              color: activeTab === tab.id ? t.text : t.textMuted,
              fontSize:"13px", fontWeight: activeTab === tab.id ? 700 : 500,
              boxShadow: activeTab === tab.id ? "0 2px 6px rgba(0,0,0,0.08)" : "none",
              transition:"all 0.15s",
            }}>
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {/* ── Contenu par tab ── */}
        {activeTab === "logs" && (
          <LogsPanel dark={dark} serverId={server.id} />
        )}

        {/* Metrics grid */}
        {activeTab === "overview" && m ? (
          <>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"10px", marginBottom:"18px" }}>
              {[
                ["Disque total", formatGb(m.diskTotalGb)],
                ["Disque libre", formatGb(m.diskFreeGb)],
                ["Disque utilisé", `${m.diskUsedPct}%`],
                ["RAM totale", formatGb(m.ramTotalGb)],
                ["RAM utilisée", formatGb(m.ramUsedGb)],
                ["CPU charge", `${m.cpuLoadPct}%`],
              ].map(([l,v]) => (
                <div key={l} style={{ background:t.surfaceAlt, borderRadius:"8px", padding:"10px 12px" }}>
                  <div style={{ fontSize:"9px", color:t.textFaint, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"4px" }}>{l}</div>
                  <div style={{ fontSize:"15px", fontWeight:700, color:t.text, fontFamily:"'JetBrains Mono',monospace" }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Disk bar */}
            <div style={{ marginBottom:"18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"6px" }}>
                <span style={{ fontSize:"11px", color:t.textFaint }}>ESPACE DISQUE</span>
                <span style={{ fontSize:"11px", fontWeight:700, color:diskColor(m.diskUsedPct), fontFamily:"'JetBrains Mono',monospace" }}>{m.diskUsedPct}%</span>
              </div>
              <div style={{ height:"7px", background:t.diskBg, borderRadius:"4px", overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${m.diskUsedPct}%`, background:diskColor(m.diskUsedPct), borderRadius:"4px", transition:"width 0.5s" }} />
              </div>
            </div>

            {/* Services */}
            {m.services.length > 0 && (
              <div style={{ marginBottom:"20px" }}>
                <div style={{ fontSize:"10px", color:t.textFaint, letterSpacing:"0.08em", fontWeight:600, marginBottom:"8px" }}>SERVICES ACTIFS</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
            {(Array.isArray(m.services) ? m.services : []).map((svc: any) => (
                    <span key={svc.name} style={{ fontSize:"11px", fontWeight:600, padding:"3px 10px", borderRadius:"20px", fontFamily:"'JetBrains Mono',monospace", background: svc.status === "running" ? "#4dab8a18" : "#d9556518", color: svc.status === "running" ? "#4dab8a" : "#d95565", border: `1px solid ${svc.status === "running" ? "#4dab8a33" : "#d9556533"}` }}>
                      {svc.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Projets de déploiement */}
            <div style={{ marginBottom:"24px", paddingTop:"18px", borderTop:`1px solid ${t.border}` }}>
              <div style={{ fontSize:"10px", color:t.textFaint, letterSpacing:"0.08em", fontWeight:600, marginBottom:"12px" }}>PROJETS DÉPLOYÉS</div>
              
              <div style={{ display:"flex", flexWrap:"wrap", gap:"8px", marginBottom:"14px" }}>
                {(server.projects || []).map(p => (
                  <span key={p.id} style={{ 
                    display:"flex", alignItems:"center", gap:"6px", fontSize:"12px", fontWeight:700, 
                    padding:"4px 10px", borderRadius:"8px", background:dark?"#5b8def20":"#5b8def10", 
                    color:"#5b8def", border:"1px solid #5b8def33" 
                  }}>
                    {p.name}
                    <button onClick={() => setProjectToDelete(p.id)} style={{ 
                      background:"none", border:"none", color:"#5b8def", cursor:"pointer", 
                      fontSize:"14px", padding:0, display:"flex", alignItems:"center", opacity:0.6 
                    }} onMouseEnter={e => e.currentTarget.style.opacity="1"} onMouseLeave={e => e.currentTarget.style.opacity="0.6"}>
                      ×
                    </button>
                  </span>
                ))}
                {(server.projects || []).length === 0 && (
                  <div style={{ fontSize:"12px", color:t.textFaint, fontStyle:"italic" }}>Aucun projet enregistré</div>
                )}
              </div>

              <div style={{ display:"flex", gap:"8px" }}>
                <input 
                  value={newProject}
                  onChange={e => setNewProject(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addProject()}
                  placeholder="Ajouter un projet (ex: VHSE)..."
                  style={{ 
                    flex:1, background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, 
                    borderRadius:"8px", padding:"8px 12px", color:t.text, fontSize:"12px", outline:"none" 
                  }}
                />
                <button 
                  onClick={addProject}
                  disabled={loading || !newProject.trim()}
                  style={{ 
                    padding:"0 16px", borderRadius:"8px", border:"none", 
                    background: (loading || !newProject.trim()) ? t.textFaint : "#5b8def", 
                    color:"#fff", fontSize:"12px", fontWeight:700, cursor:"pointer" 
                  }}>
                  {loading ? "..." : "Ajouter"}
                </button>
              </div>
            </div>

            <div style={{ fontSize:"11px", color:t.textFaint }}>
              Dernière lecture agent : <span style={{ fontFamily:"'JetBrains Mono',monospace" }}>{new Date(m.lastPolledAt).toLocaleString("fr-FR")}</span>
            </div>
          </>
        ) : activeTab === "overview" && (
          <div style={{ background:t.surfaceAlt, borderRadius:"10px", padding:"24px", textAlign:"center" }}>
            <div style={{ fontSize:"24px", marginBottom:"8px" }}>📡</div>
            <div style={{ fontSize:"13px", fontWeight:700, color:t.text, marginBottom:"6px" }}>Agent non connecté</div>
            <div style={{ fontSize:"12px", color:t.textMuted, lineHeight:1.6 }}>
              Installer l'agent sur <span style={{ fontFamily:"'JetBrains Mono',monospace", color:"#5b8def" }}>{server.ip}</span>
              {" "}(port {server.agentPort}) pour lire les métriques en temps réel.
            </div>
          </div>
        )}

        {activeTab === "overview" && server.description && (
          <div style={{ fontSize:"12px", color:t.textMuted, fontStyle:"italic", borderTop:`1px solid ${t.border}`, paddingTop:"14px", marginTop:"16px" }}>{server.description}</div>
        )}
      </div>

      <ConfirmModal
        isOpen={projectToDelete !== null}
        onClose={() => setProjectToDelete(null)}
        onConfirm={deleteProject}
        title="Supprimer le projet ?"
        message="Êtes-vous sûr de vouloir supprimer ce projet de ce serveur ?"
        confirmText="Supprimer"
        cancelText="Annuler"
      />
    </div>
  );
}

export function AddServerModal({ onClose, onAdd, dark }: { onClose: () => void; onAdd: (s: Server) => void; dark: boolean }) {
  const t = useTokens(dark);
  const [form, setForm] = useState({ ip:"", name:"", environment:"Dev" as Environment, provider:"OVH" as Provider, agentPort:"9101", agentToken:"", description:"" });
  const inp: React.CSSProperties = { background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, borderRadius:"7px", padding:"9px 12px", color:t.text, fontSize:"13px", width:"100%", outline:"none", fontFamily:"inherit" };
  const lbl: React.CSSProperties = { fontSize:"10px", color:t.textFaint, letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:"5px", fontWeight:600 };

  const { showToast } = useAppStore();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Pause auto-refresh while the form is open
  useEffect(() => {
    setPauseAutoRefresh(true);
    return () => setPauseAutoRefresh(false);
  }, []);

  const submit = async () => {
    if (!form.ip || !form.name) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          agentPort: parseInt(form.agentPort) || 9101
        })
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur lors de l'ajout");
      }
      const newSrv = await res.json();
      showToast(`Serveur "${newSrv.name}" ajouté avec succès`);
      onAdd(newSrv);
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:t.surface, border:`1px solid ${t.borderMid}`, borderRadius:"14px", padding:"28px 32px", width:"500px", maxWidth:"95vw" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"22px" }}>
          <div>
            <div style={{ fontSize:"16px", fontWeight:800, color:t.text }}>Ajouter un serveur</div>
            <div style={{ fontSize:"11px", color:t.textMuted, marginTop:"2px" }}>Les métriques seront lues automatiquement via l'agent</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:t.textMuted, cursor:"pointer", fontSize:"20px" }}>×</button>
        </div>

        {error && (
          <div style={{ padding: "10px", borderRadius: "6px", background: "#d9556515", color: "#d95565", fontSize: "12px", marginBottom: "16px", fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
          <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Adresse IP *</label><input style={inp} placeholder="ex: 192.168.1.100" value={form.ip} onChange={e => setForm(f => ({ ...f, ip:e.target.value }))} /></div>
          <div style={{ gridColumn:"1/-1" }}><label style={lbl}>Nom du serveur *</label><input style={inp} placeholder="ex: PROD API GATEWAY" value={form.name} onChange={e => setForm(f => ({ ...f, name:e.target.value }))} /></div>
          <div>
            <label style={lbl}>Port Agent</label>
            <input style={inp} placeholder="9101" value={form.agentPort} onChange={e => setForm(f => ({ ...f, agentPort: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Token d'authentification</label>
            <input style={inp} type="password" placeholder="secret-token..." value={form.agentToken} onChange={e => setForm(f => ({ ...f, agentToken: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Hébergeur</label>
            <select style={{ ...inp, cursor:"pointer" }} value={form.provider} onChange={e => setForm(f => ({ ...f, provider:e.target.value as Provider }))}>
              {(["OVH","Azure","AWS"] as Provider[]).map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Environnement</label>
            <select style={{ ...inp, cursor:"pointer" }} value={form.environment} onChange={e => setForm(f => ({ ...f, environment:e.target.value as Environment }))}>
              {["Dev", "Demo", "Pilote", "Prod", "Backup"].map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:"flex", gap:"10px", marginTop:"22px" }}>
          <button onClick={submit} disabled={saving} style={{ flex:1, padding:"10px", borderRadius:"8px", border:"none", background: saving ? t.textFaint : "#5b8def", color:"#fff", fontSize:"13px", fontWeight:700, cursor: saving ? "not-allowed" : "pointer" }}>
            {saving ? "Chargement..." : "Ajouter le serveur"}
          </button>
          <button onClick={onClose} style={{ padding:"10px 16px", borderRadius:"8px", border:`1px solid ${t.border}`, background:"none", color:t.textMuted, fontSize:"13px", cursor:"pointer" }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}

export function AddProjectModal({ serverId, onClose, onAdd, dark }: { serverId: number; onClose: () => void; onAdd: (p: any) => void; dark: boolean }) {
  const t = useTokens(dark);
  const { showToast } = useAppStore();
  const [name, setName] = useState("");
  const [type, setType] = useState("app");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await apiFetch(`/api/servers/${serverId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), type })
      });
      if (res.ok) {
        const added = await res.json();
        showToast(`Projet "${name}" ajouté`);
        onAdd(added);
        onClose();
      } else {
        const d = await res.json();
        showToast(d.error || "Erreur lors de l'ajout", "error");
      }
    } catch (e) {
      console.error(e);
      showToast("Erreur lors de l'ajout", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1100, backdropFilter:"blur(4px)" }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:t.surface, border:`1px solid ${t.borderMid}`, borderRadius:"14px", padding:"28px 32px", width:"400px", maxWidth:"95vw" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"22px" }}>
          <div style={{ fontSize:"16px", fontWeight:800, color:t.text }}>Nouveau projet</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:t.textMuted, cursor:"pointer", fontSize:"20px" }}>×</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
          <div>
            <label style={{ fontSize:"10px", color:t.textFaint, letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:"5px", fontWeight:600 }}>Nom du projet</label>
            <input 
              style={{ background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, borderRadius:"7px", padding:"9px 12px", color:t.text, fontSize:"13px", width:"100%", outline:"none" }} 
              placeholder="ex: Nebulops Dashboard" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              autoFocus
            />
          </div>
          <div>
            <label style={{ fontSize:"10px", color:t.textFaint, letterSpacing:"0.08em", textTransform:"uppercase", display:"block", marginBottom:"5px", fontWeight:600 }}>Type</label>
            <select 
              style={{ background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, borderRadius:"7px", padding:"9px 12px", color:t.text, fontSize:"13px", width:"100%", outline:"none", cursor:"pointer" }} 
              value={type} 
              onChange={e => setType(e.target.value)}
            >
              <option value="app">Application (Frontend)</option>
              <option value="api">API / Backend</option>
              <option value="db">Base de données</option>
              <option value="worker">Worker / Script</option>
            </select>
          </div>
        </div>

        <div style={{ display:"flex", gap:"10px", marginTop:"22px" }}>
          <button onClick={submit} disabled={saving || !name.trim()} style={{ flex:1, padding:"10px", borderRadius:"8px", border:"none", background: (saving || !name.trim()) ? t.textFaint : "#5b8def", color:"#fff", fontSize:"13px", fontWeight:700, cursor: (saving || !name.trim()) ? "not-allowed" : "pointer" }}>
            {saving ? "..." : "Ajouter le projet"}
          </button>
          <button onClick={onClose} style={{ padding:"10px 16px", borderRadius:"8px", border:`1px solid ${t.border}`, background:"none", color:t.textMuted, fontSize:"13px", cursor:"pointer" }}>
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
