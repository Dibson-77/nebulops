"use client";

/**
 * components/dashboard/AlertSettingsPanel.tsx
 * ─────────────────────────────────────────────
 * Panneau de configuration des alertes WhatsApp via whatsapp-web.js (FREE).
 * Intégré dans AdminPanel comme onglet "WhatsApp".
 */

import { useState, useEffect, useRef } from "react";
import { useTokens } from "@/hooks/use-tokens";
import { useAppStore } from "@/store/use-app-store";
import { apiFetch } from "@/lib/api-client";
import type { AlertSettings, WAStatus } from "@/types";
import {
  MessageCircle, Send, Save, Loader2, CheckCircle2,
  AlertTriangle, Wifi, WifiOff, QrCode, RefreshCw, LogOut,
} from "lucide-react";

// ─── Sous-composants ──────────────────────────────────────────────────────────

function Field({ label, children, t }: { label: string; children: React.ReactNode; t: any }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <label style={{
        display: "block", marginBottom: "6px",
        fontSize: "12px", fontWeight: 700, color: t.textFaint,
        letterSpacing: "0.1em", textTransform: "uppercase" as const,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, t }: {
  value: string; onChange: (v: string) => void; placeholder?: string; t: any;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: "100%", padding: "10px 14px", borderRadius: "10px",
        border: `1px solid ${t.borderMid}`, background: t.surface, color: t.text,
        fontSize: "14px", outline: "none", fontFamily: "inherit",
        boxSizing: "border-box" as const,
      }}
      onFocus={e => e.currentTarget.style.borderColor = "#5b8def"}
      onBlur={e => e.currentTarget.style.borderColor = t.borderMid}
    />
  );
}

function NumberInput({ value, onChange, min, max, t }: {
  value: number; onChange: (v: number) => void; min?: number; max?: number; t: any;
}) {
  return (
    <input
      type="number" value={value} min={min} max={max}
      onChange={e => onChange(Number(e.target.value))}
      style={{
        width: "120px", padding: "10px 14px", borderRadius: "10px",
        border: `1px solid ${t.borderMid}`, background: t.surface, color: t.text,
        fontSize: "14px", outline: "none", fontFamily: "inherit",
      }}
      onFocus={e => e.currentTarget.style.borderColor = "#5b8def"}
      onBlur={e => e.currentTarget.style.borderColor = t.borderMid}
    />
  );
}

function Toggle({ enabled, onChange, label, t }: {
  enabled: boolean; onChange: (v: boolean) => void; label: string; t: any;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
      <button
        onClick={() => onChange(!enabled)}
        style={{
          width: "48px", height: "26px", borderRadius: "13px", border: "none",
          background: enabled ? "#4dab8a" : t.borderMid,
          position: "relative", cursor: "pointer", transition: "background 0.2s", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: "3px",
          left: enabled ? "25px" : "3px",
          width: "20px", height: "20px", borderRadius: "50%",
          background: "#fff", transition: "left 0.2s",
        }} />
      </button>
      <span style={{ fontSize: "15px", fontWeight: 700, color: t.text }}>{label}</span>
    </div>
  );
}

// ─── Indicateur de statut WhatsApp ────────────────────────────────────────────

const STATE_META: Record<string, { label: string; color: string; bg: string }> = {
  disconnected:  { label: "Déconnecté",      color: "#8891a0", bg: "#8891a018" },
  initializing:  { label: "Initialisation…", color: "#d4a843", bg: "#d4a84318" },
  qr_pending:    { label: "En attente du QR", color: "#5b8def", bg: "#5b8def18" },
  authenticated: { label: "Authentifié…",    color: "#4dab8a", bg: "#4dab8a18" },
  ready:         { label: "Connecté ✓",       color: "#4dab8a", bg: "#4dab8a18" },
  error:         { label: "Erreur",           color: "#d95565", bg: "#d9556518" },
};

function StatusBadge({ state, t }: { state: string; t: any }) {
  const meta = STATE_META[state] ?? STATE_META.disconnected;
  const isSpinning = state === "initializing" || state === "authenticated";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: "6px",
      padding: "4px 12px", borderRadius: "20px",
      background: meta.bg, color: meta.color,
      fontSize: "12px", fontWeight: 800,
    }}>
      {isSpinning
        ? <Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} />
        : state === "ready"
          ? <Wifi size={12} />
          : state === "disconnected" || state === "error"
            ? <WifiOff size={12} />
            : <QrCode size={12} />
      }
      {meta.label}
    </span>
  );
}

// ─── Panel principal ──────────────────────────────────────────────────────────

export function AlertSettingsPanel({ dark }: { dark: boolean }) {
  const t = useTokens(dark);
  const { showToast } = useAppStore();

  const [form, setForm] = useState({
    whatsappEnabled: false,
    whatsappTo:      "",
    diskThreshold:   80,
    cpuThreshold:    85,
    ramThreshold:    90,
    cooldownMinutes: 30,
  });
  const [saving,     setSaving]     = useState(false);
  const [testing,    setTesting]    = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [waStatus,   setWaStatus]   = useState<WAStatus>({ state: "disconnected" });
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Charge les settings
  useEffect(() => {
    apiFetch("/api/admin/alert-settings")
      .then(r => r.ok ? r.json() : null)
      .then((d: AlertSettings | null) => {
        if (!d) return;
        setForm({
          whatsappEnabled: d.whatsappEnabled,
          whatsappTo:      d.whatsappTo,
          diskThreshold:   d.diskThreshold,
          cpuThreshold:    d.cpuThreshold,
          ramThreshold:    d.ramThreshold,
          cooldownMinutes: d.cooldownMinutes,
        });
      })
      .catch(() => {});
  }, []);

  // Poll le statut WhatsApp toutes les 3s quand en attente
  const fetchStatus = () => {
    apiFetch("/api/admin/whatsapp-status")
      .then(r => r.ok ? r.json() : null)
      .then((s: WAStatus | null) => { if (s) setWaStatus(s); })
      .catch(() => {});
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  useEffect(() => {
    const shouldPoll = connecting || ["initializing", "qr_pending", "authenticated"].includes(waStatus.state);
    if (shouldPoll && !pollRef.current) {
      pollRef.current = setInterval(fetchStatus, 2000);
    } else if (!shouldPoll && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [waStatus.state, connecting]);

  const handleConnect = async () => {
    setConnecting(true);
    await apiFetch("/api/admin/whatsapp-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "connect" }),
    }).catch(() => {});
    setConnecting(false);
    fetchStatus();
  };

  const handleDisconnect = async () => {
    await apiFetch("/api/admin/whatsapp-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "disconnect" }),
    }).catch(() => {});
    fetchStatus();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/api/admin/alert-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) showToast("Paramètres sauvegardés");
      else showToast("Erreur lors de la sauvegarde", "error");
    } finally { setSaving(false); }
  };

  const handleTest = async () => {
    setTesting(true); setTestResult(null);
    try {
      const res = await apiFetch("/api/admin/alert-settings/test", { method: "POST" });
      setTestResult(await res.json());
    } finally { setTesting(false); }
  };

  const set = (key: keyof typeof form) => (v: any) => setForm(f => ({ ...f, [key]: v }));

  const sectionStyle: React.CSSProperties = {
    background: t.surfaceAlt, border: `1px solid ${t.border}`,
    borderRadius: "12px", padding: "20px 24px", marginBottom: "16px",
  };

  return (
    <div style={{ maxWidth: "720px" }}>
      {/* ── En-tête ── */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "24px" }}>
        <MessageCircle size={22} color="#25d366" strokeWidth={2} />
        <div>
          <div style={{ fontSize: "18px", fontWeight: 800, color: t.text }}>Alertes WhatsApp</div>
          <div style={{ fontSize: "13px", color: t.textFaint }}>
            100% gratuit via votre propre numéro WhatsApp — aucun abonnement, aucune API payante.
          </div>
        </div>
      </div>

      {/* ── Connexion WhatsApp ── */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <div style={{ fontSize: "14px", fontWeight: 800, color: t.text }}>Connexion du bot</div>
          <StatusBadge state={waStatus.state} t={t} />
        </div>

        {/* QR code */}
        {waStatus.state === "qr_pending" && waStatus.qrCode && (
          <div style={{ marginBottom: "16px", textAlign: "center" }}>
            <div style={{
              display: "inline-block", padding: "12px",
              background: "#fff", borderRadius: "12px",
              border: `2px solid #25d366`,
            }}>
              <img src={waStatus.qrCode} alt="QR WhatsApp" width={240} height={240} style={{ display: "block" }} />
            </div>
            <div style={{ marginTop: "10px", fontSize: "13px", color: t.textFaint }}>
              Ouvrez WhatsApp → <strong>⋮</strong> → <strong>Appareils liés</strong> → Scannez ce code
            </div>
          </div>
        )}

        {/* Numéro connecté */}
        {waStatus.state === "ready" && waStatus.phone && (
          <div style={{
            display: "flex", alignItems: "center", gap: "10px",
            padding: "10px 14px", borderRadius: "10px",
            background: "#4dab8a18", border: "1px solid #4dab8a33",
            marginBottom: "16px",
          }}>
            <MessageCircle size={16} color="#4dab8a" />
            <span style={{ fontSize: "14px", color: "#4dab8a", fontWeight: 700 }}>
              Bot connecté : +{waStatus.phone}
            </span>
          </div>
        )}

        {/* Erreur */}
        {waStatus.state === "error" && waStatus.error && (
          <div style={{
            padding: "10px 14px", borderRadius: "10px",
            background: "#d9556518", border: "1px solid #d9556533",
            fontSize: "13px", color: "#d95565", marginBottom: "16px",
          }}>
            {waStatus.error}
          </div>
        )}

        {/* Boutons */}
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {waStatus.state !== "ready" && (
            <button
              onClick={handleConnect}
              disabled={connecting || ["initializing", "qr_pending", "authenticated"].includes(waStatus.state)}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "9px 18px", borderRadius: "9px", border: "none",
                background: "#25d366", color: "#fff", fontSize: "13px", fontWeight: 700,
                cursor: "pointer", opacity: connecting ? 0.7 : 1,
              }}
            >
              {connecting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <QrCode size={14} />}
              {connecting ? "Démarrage du service…" : waStatus.state === "qr_pending" ? "En attente du scan…" : "Connecter WhatsApp"}
            </button>
          )}
          {waStatus.state === "ready" && (
            <button
              onClick={handleDisconnect}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                padding: "9px 18px", borderRadius: "9px",
                border: `1px solid ${t.border}`, background: "transparent",
                color: t.textMuted, fontSize: "13px", fontWeight: 700, cursor: "pointer",
              }}
            >
              <LogOut size={14} /> Déconnecter
            </button>
          )}
          <button
            onClick={fetchStatus}
            style={{
              display: "flex", alignItems: "center", gap: "6px",
              padding: "9px 14px", borderRadius: "9px",
              border: `1px solid ${t.border}`, background: "transparent",
              color: t.textFaint, fontSize: "13px", cursor: "pointer",
            }}
          >
            <RefreshCw size={13} /> Rafraîchir
          </button>
        </div>
      </div>

      {/* ── Activation + destinataire ── */}
      <div style={sectionStyle}>
        <Toggle
          enabled={form.whatsappEnabled}
          onChange={set("whatsappEnabled")}
          label="Activer les alertes WhatsApp"
          t={t}
        />
        {form.whatsappEnabled && (
          <Field label="Numéro destinataire (qui recevra les alertes)" t={t}>
            <Input
              value={form.whatsappTo}
              onChange={set("whatsappTo")}
              placeholder="+2250769617143"
              t={t}
            />
            <div style={{ fontSize: "12px", color: t.textFaint, marginTop: "4px" }}>
              Format international avec le + · Peut être différent du numéro bot
            </div>
          </Field>
        )}
      </div>

      {form.whatsappEnabled && (
        <>
          {/* ── Seuils ── */}
          <div style={sectionStyle}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: t.text, marginBottom: "16px" }}>Seuils d'alerte</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <Field label="Disque (%)" t={t}>
                <NumberInput value={form.diskThreshold} onChange={set("diskThreshold")} min={50} max={99} t={t} />
              </Field>
              <Field label="CPU (%)" t={t}>
                <NumberInput value={form.cpuThreshold} onChange={set("cpuThreshold")} min={50} max={99} t={t} />
              </Field>
              <Field label="RAM (%)" t={t}>
                <NumberInput value={form.ramThreshold} onChange={set("ramThreshold")} min={50} max={99} t={t} />
              </Field>
            </div>
            <Field label="Cooldown (minutes)" t={t}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <NumberInput value={form.cooldownMinutes} onChange={set("cooldownMinutes")} min={5} max={1440} t={t} />
                <span style={{ fontSize: "13px", color: t.textFaint }}>
                  Délai minimum entre 2 alertes du même type pour le même serveur
                </span>
              </div>
            </Field>
          </div>

          {/* ── Test ── */}
          <div style={sectionStyle}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: t.text, marginBottom: "12px" }}>
              Tester la configuration
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <button
                onClick={handleTest}
                disabled={testing || waStatus.state !== "ready"}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "10px 20px", borderRadius: "10px", border: "none",
                  background: waStatus.state === "ready" ? "#25d366" : t.borderMid,
                  color: "#fff", fontSize: "14px", fontWeight: 700,
                  cursor: waStatus.state !== "ready" ? "not-allowed" : "pointer",
                  opacity: testing ? 0.7 : 1,
                }}
              >
                {testing ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Send size={16} />}
                Envoyer un message test
              </button>
              {waStatus.state !== "ready" && (
                <span style={{ fontSize: "12px", color: t.textFaint }}>
                  Connectez le bot WhatsApp d'abord
                </span>
              )}
              {testResult && (
                <div style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  fontSize: "13px", fontWeight: 700,
                  color: testResult.ok ? "#4dab8a" : "#d95565",
                }}>
                  {testResult.ok
                    ? <><CheckCircle2 size={16} /> Message envoyé !</>
                    : <><AlertTriangle size={16} /> {testResult.error || "Échec"}</>
                  }
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Sauvegarder ── */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "12px 28px", borderRadius: "10px", border: "none",
            background: "#5b8def", color: "#fff", fontSize: "15px", fontWeight: 800,
            cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? <Loader2 size={16} /> : <Save size={16} />}
          Sauvegarder
        </button>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
