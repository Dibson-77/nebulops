"use client";

/**
 * src/app/(dashboard)/profile/page.tsx
 * ──────────────────────────────────────
 * Page "Mon profil" — infos personnelles + changement de mot de passe
 *
 * Brancher sur :
 *   GET  /api/auth/me              → données de l'utilisateur connecté
 *   PUT  /api/users/:id            → mise à jour firstname / lastname / phoneNumber
 *   POST /api/auth/change-password → { oldPassword, newPassword, confirmPassword }
 *   POST /api/auth/logout-all      → révoquer toutes les sessions
 */

import { useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useTokens } from "@/hooks/use-tokens";
import { ConfirmModal } from "@/shared/components/molecules/ConfirmModal";
import { apiFetch } from "@/lib/api-client";
import { Eye, EyeOff } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type Role = "admin" | "operator" | "viewer";

interface UserData {
  id:           number;
  firstname:    string;
  lastname:     string;
  email:        string;
  phoneNumber:  string;
  role:         Role;
  profileLabel: string;
  joinedAt:     string;
  lastLoginAt:  string;
  loginCount:   number;
  actionCount:  number;
  activities:   { label: string; time: string; ok: boolean }[];
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<Role, string> = {
  admin:    "#d95565",
  operator: "#d4a843",
  viewer:   "#7b84c9",
};

const ROLE_LABELS: Record<Role, string> = {
  admin:    "Administrateur",
  operator: "Opérateur",
  viewer:   "Observateur",
};

const MOCK_USER: UserData = {
  id:           1,
  firstname:    "Jean-Marc",
  lastname:     "Kouassi",
  email:        "jm.kouassi@company.ci",
  phoneNumber:  "+225 07 XX XX XX",
  role:         "admin",
  profileLabel: "Administrateur",
  joinedAt:     "2026-03-19T00:00:00Z",
  lastLoginAt:  new Date().toISOString(),
  loginCount:   0,
  actionCount:  0,
  activities:   [],
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function initials(u: UserData) {
  return ((u.firstname[0] ?? "") + (u.lastname[0] ?? "")).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

function relativeTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) {
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (days === 1) {
    return "Hier " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  if (days < 7) {
    return `Il y a ${days} jours`;
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

function scorePassword(pwd: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pwd.length >= 8)          s++;
  if (/[A-Z]/.test(pwd))        s++;
  if (/[0-9]/.test(pwd))        s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  if (pwd.length >= 12)         s++;
  const rows: [string, string][] = [
    ["—",           "#2d4263"],
    ["Très faible", "#d95565"],
    ["Faible",      "#e08a4a"],
    ["Moyen",       "#d4a843"],
    ["Fort",        "#4dab8a"],
    ["Très fort",   "#10b981"],
  ];
  const [label, color] = rows[Math.min(s, rows.length - 1)];
  return { score: s, label, color };
}

// ─────────────────────────────────────────────────────────────────────────────
// ATOMS
// ─────────────────────────────────────────────────────────────────────────────

function FieldLabel({ children, t }: { children: React.ReactNode; t: any }) {
  return (
    <label style={{
      display: "block", marginBottom: "6px",
      fontSize: "11px", fontWeight: 700, color: t.textFaint,
      letterSpacing: "0.1em", textTransform: "uppercase" as const,
    }}>
      {children}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder = "", readOnly = false,
  type = "text", t,
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  readOnly?: boolean; type?: string; t: any;
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";

  return (
    <div style={{ position: "relative" }}>
      <input
        type={isPassword && !visible ? "password" : "text"}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          width: "100%",
          padding: "11px 14px",
          paddingRight: isPassword ? "40px" : "14px",
          borderRadius: "10px",
          border: `1px solid ${t.borderMid}`,
          background: readOnly ? t.diskBg : t.surfaceAlt,
          color: readOnly ? t.textMuted : t.text,
          fontSize: "14px",
          outline: "none",
          fontFamily: "inherit",
          cursor: readOnly ? "not-allowed" : "text",
          transition: "border-color 0.15s",
        }}
        onFocus={e => { if (!readOnly) (e.target as HTMLInputElement).style.borderColor = "#5b8def"; }}
        onBlur={e => { (e.target as HTMLInputElement).style.borderColor = t.borderMid; }}
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setVisible(v => !v)}
          style={{
            position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer",
            color: t.textFaint, fontSize: "14px", padding: "0", lineHeight: 1,
          }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      )}
    </div>
  );
}

function StrengthBar({ password, t }: { password: string; t: any }) {
  const { score, label, color } = scorePassword(password);
  if (!password) return null;

  const rules = [
    { text: "8 caractères minimum",            ok: password.length >= 8 },
    { text: "Au moins une majuscule",           ok: /[A-Z]/.test(password) },
    { text: "Au moins un chiffre",              ok: /[0-9]/.test(password) },
    { text: "Un caractère spécial (!@#...)",    ok: /[^A-Za-z0-9]/.test(password) },
  ];

  return (
    <div style={{ marginTop: "10px" }}>
      {/* 5 segments */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "6px" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: "4px", borderRadius: "2px",
            background: i < score ? color : t.diskBg,
            transition: "background 0.25s",
          }} />
        ))}
      </div>
      <div style={{ fontSize: "11px", fontWeight: 700, color, marginBottom: "10px" }}>
        Force : {label}
      </div>
      {/* Règles */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {rules.map(r => (
          <div key={r.text} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", color: r.ok ? "#4dab8a" : t.textFaint, transition: "color 0.2s" }}>
            <div style={{
              width: "5px", height: "5px", borderRadius: "50%", flexShrink: 0,
              background: r.ok ? "#4dab8a" : t.diskBg, transition: "background 0.2s",
            }} />
            {r.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function Toast({ msg, ok, onDone }: { msg: string; ok: boolean; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", top: "28px", right: "28px", zIndex: 9999,
      padding: "14px 20px", borderRadius: "12px",
      background: ok ? "#4dab8a14" : "#d9556514",
      border: `1px solid ${ok ? "#4dab8a44" : "#d9556544"}`,
      color: ok ? "#4dab8a" : "#d95565",
      fontSize: "13px", fontWeight: 700,
      display: "flex", alignItems: "center", gap: "10px",
      boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      backdropFilter: "blur(8px)",
    }}>
      <span style={{ fontSize: "16px" }}>{ok ? "✓" : "✕"}</span>
      {msg}
    </div>
  );
}

function BtnPrimary({ children, onClick, disabled = false, loading = false, color = "#5b8def" }: {
  children: React.ReactNode; onClick: () => void;
  disabled?: boolean; loading?: boolean; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        padding: "11px 22px", borderRadius: "10px", border: "none",
        background: disabled || loading ? color + "50" : color,
        color: "#fff", fontSize: "14px", fontWeight: 700,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        display: "inline-flex", alignItems: "center", gap: "8px",
        transition: "all 0.15s",
      }}
    >
      {loading ? <span style={{ animation: "spin .8s linear infinite", display: "inline-block" }}>⏳</span> : null}
      {children}
    </button>
  );
}

function BtnGhost({ children, onClick, t }: { children: React.ReactNode; onClick: () => void; t: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "11px 18px", borderRadius: "10px",
        border: `1px solid ${t.border}`, background: "none",
        color: t.textMuted, fontSize: "14px", fontWeight: 700, cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const { dark } = useAppStore();
  const t = useTokens(dark);

  // ── Chargement user ──────────────────────────────────────────────────────────
  const [user, setUser] = useState<UserData>(MOCK_USER);

  useEffect(() => {
    apiFetch("/api/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setUser({
          id:           data.sub ?? data.id ?? 1,
          firstname:    data.firstname ?? "",
          lastname:     data.lastname ?? "",
          email:        data.email ?? "",
          phoneNumber:  data.phoneNumber ?? "",
          role:         (data.profileLabel?.toLowerCase() as Role) ?? "viewer",
          profileLabel: data.profileLabel ?? "Observateur",
          joinedAt:     data.joinedAt ?? new Date().toISOString(),
          lastLoginAt:  data.activities?.[0]?.time ?? new Date().toISOString(),
          loginCount:   data.loginCount ?? 0,
          actionCount:  data.actionCount ?? 0,
          activities:   data.activities ?? [],
        });
      })
      .catch(() => {});
  }, []);

  // ── Formulaire profil ────────────────────────────────────────────────────────
  const [pf, setPf] = useState({ 
    firstname: user.firstname, 
    lastname: user.lastname, 
    phone: user.phoneNumber 
  });
  const [pfDirty, setPfDirty]   = useState(false);
  const [pfLoading, setPfLoading] = useState(false);

  useEffect(() => {
    setPf({ firstname: user.firstname, lastname: user.lastname, phone: user.phoneNumber });
  }, [user]);

  const setField = (k: keyof typeof pf, v: string) => {
    setPf(f => ({ ...f, [k]: v }));
    setPfDirty(true);
  };

  // ── Formulaire password ──────────────────────────────────────────────────────
  const [pw, setPw]             = useState({ current: "", next: "", confirm: "" });
  const [pwLoading, setPwLoading] = useState(false);

  const pwScore     = scorePassword(pw.next);
  const pwMatch     = pw.next.length > 0 && pw.next === pw.confirm;
  const pwCanSubmit = pw.current.length > 0 && pwScore.score >= 3 && pwMatch;

  // ── Modals confirmation ─────────────────────────────────────────────────────
  const [showRevokeModal, setShowRevokeModal] = useState(false);

  // ── Toast ────────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const flash = useCallback((msg: string, ok = true) => setToast({ msg, ok }), []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    setPfLoading(true);
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstname: pf.firstname, lastname: pf.lastname, phoneNumber: pf.phone || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Erreur");
      setUser(u => ({ ...u, firstname: pf.firstname, lastname: pf.lastname, phoneNumber: pf.phone }));
      setPfDirty(false);
      flash("Profil mis à jour avec succès.");
    } catch (e: any) {
      flash(e.message ?? "Erreur serveur.", false);
    } finally {
      setPfLoading(false);
    }
  };

  const changePassword = async () => {
    if (!pwCanSubmit) return;
    setPwLoading(true);
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          oldPassword: pw.current, 
          newPassword: pw.next,
          confirmPassword: pw.confirm 
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Mot de passe actuel incorrect.");
      setPw({ current: "", next: "", confirm: "" });
      flash("Mot de passe changé avec succès.");
    } catch (e: any) {
      flash(e.message ?? "Erreur serveur.", false);
    } finally {
      setPwLoading(false);
    }
  };

  const revokeAll = async () => {
    try {
      await apiFetch("/api/auth/logout-all", { method: "POST" });
      flash("Toutes les sessions ont été révoquées.");
      setShowRevokeModal(false);
      setTimeout(() => { window.location.href = "/"; }, 1600);
    } catch {
      flash("Erreur lors de la révocation.", false);
    }
  };

  // ── Styles communs ───────────────────────────────────────────────────────────
  const card: React.CSSProperties = {
    background: t.surface,
    border: `1px solid ${t.border}`,
    borderRadius: "14px",
    padding: "24px 26px",
  };

  const roleColor = ROLE_COLORS[user.role] ?? "#7b84c9";
  const inits     = initials(user);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input:focus { outline: none; }
      `}</style>

      {/* ── Page header ── */}
      <div style={{ marginBottom: "28px" }}>
        <h1 style={{ fontSize: "22px", fontWeight: 800, color: t.text, letterSpacing: "-0.5px", marginBottom: "6px" }}>
          Mon profil
        </h1>
        <p style={{ fontSize: "13px", color: t.textMuted }}>
          Gérez vos informations personnelles et la sécurité de votre compte.
        </p>
      </div>

      {/* ── Grid 2 colonnes ── */}
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "20px", alignItems: "start" }}>

        {/* ════════════════════════════
            COLONNE GAUCHE
            ════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* — Card identité — */}
          <div style={card}>

            {/* Avatar + nom + rôle */}
            <div style={{ textAlign: "center", paddingBottom: "22px", marginBottom: "22px", borderBottom: `1px solid ${t.border}` }}>
              <div style={{
                width: 76, height: 76, borderRadius: "50%",
                background: "linear-gradient(135deg,#5b8def,#6b70bf)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 28, fontWeight: 800, color: "#fff",
                margin: "0 auto 16px",
                border: `3px solid ${t.border}`,
                boxShadow: "0 0 0 4px " + roleColor + "18",
              }}>
                {inits}
              </div>
              <div style={{ fontSize: "17px", fontWeight: 800, color: t.text, letterSpacing: "-0.3px", marginBottom: "4px" }}>
                {user.firstname} {user.lastname}
              </div>
              <div style={{ fontSize: "12px", color: t.textMuted, fontFamily: "'JetBrains Mono',monospace", marginBottom: "12px" }}>
                {user.email}
              </div>
              {/* Role badge */}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: "6px",
                padding: "4px 14px", borderRadius: "20px",
                background: roleColor + "18", color: roleColor,
                border: `1px solid ${roleColor}33`,
                fontSize: "11px", fontWeight: 800,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: roleColor }} />
                {ROLE_LABELS[user.role] ?? user.profileLabel}
              </span>
            </div>

            {/* Tableau infos */}
            {([
              { label: "Statut",        node: <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "20px", background: "#4dab8a18", color: "#4dab8a", border: "1px solid #4dab8a33" }}>Actif</span> },
              { label: "Téléphone",     node: <span style={{ fontSize: "12px", color: t.text, fontFamily: "'JetBrains Mono',monospace" }}>{user.phoneNumber || "—"}</span> },
              { label: "Membre depuis", node: <span style={{ fontSize: "12px", color: t.text }}>{fmtDate(user.joinedAt)}</span> },
              { label: "Authentif.",    node: <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 10px", borderRadius: "20px", background: "#d4a84318", color: "#d4a843", border: "1px solid #d4a84333" }}>OTP Email</span> },
            ] as { label: string; node: React.ReactNode }[]).map((row, i, arr) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: i < arr.length - 1 ? `1px solid ${t.diskBg}` : "none" }}>
                <div style={{ fontSize: "10px", color: t.textFaint, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const }}>{row.label}</div>
                {row.node}
              </div>
            ))}
          </div>

          {/* — Card activité — */}
          <div style={card}>
            <div style={{ fontSize: "13px", fontWeight: 800, color: t.text, marginBottom: "16px" }}>Activité du compte</div>

            {/* KPI 2 colonnes */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "18px" }}>
              {[
                { label: "Connexions",  value: String(user.loginCount),  sub: "ce mois" },
                { label: "Actions",     value: String(user.actionCount), sub: "au total" },
              ].map(s => (
                <div key={s.label} style={{ background: t.surfaceAlt, borderRadius: "10px", padding: "14px 16px" }}>
                  <div style={{ fontSize: "10px", color: t.textFaint, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "8px" }}>{s.label}</div>
                  <div style={{ fontSize: "24px", fontWeight: 800, color: t.text, fontFamily: "'JetBrains Mono',monospace", letterSpacing: "-1px", lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: "11px", color: t.textMuted, marginTop: "4px" }}>{s.sub}</div>
                </div>
              ))}
            </div>

            {/* Timeline d'activité */}
            <div style={{ fontSize: "10px", color: t.textFaint, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: "10px" }}>Récent</div>
            {user.activities.length === 0 && (
              <div style={{ fontSize: "12px", color: t.textMuted, padding: "10px 0" }}>Aucune activité récente</div>
            )}
            {user.activities.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderBottom: i < user.activities.length - 1 ? `1px solid ${t.diskBg}` : "none" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: a.ok ? "#4dab8a" : "#d95565", flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: "12px", color: t.text, fontWeight: 500 }}>{a.label}</div>
                <div style={{ fontSize: "11px", color: t.textFaint, fontFamily: "'JetBrains Mono',monospace" }}>{relativeTime(a.time)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ════════════════════════════
            COLONNE DROITE
            ════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* — Card informations personnelles — */}
          <div style={card}>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: t.text, marginBottom: "4px" }}>Informations personnelles</div>
              <div style={{ fontSize: "12px", color: t.textMuted }}>Modifiez vos coordonnées de compte</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
              <div>
                <FieldLabel t={t}>Prénom</FieldLabel>
                <TextInput value={pf.firstname} onChange={v => setField("firstname", v)} placeholder="Prénom" t={t} />
              </div>
              <div>
                <FieldLabel t={t}>Nom</FieldLabel>
                <TextInput value={pf.lastname} onChange={v => setField("lastname", v)} placeholder="Nom" t={t} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <FieldLabel t={t}>Email</FieldLabel>
                <TextInput value={pf.firstname ? user.email : ""} readOnly t={t} />
                <div style={{ fontSize: "11px", color: t.textFaint, marginTop: "5px" }}>L'email ne peut pas être modifié ici.</div>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <FieldLabel t={t}>Téléphone</FieldLabel>
                <TextInput value={pf.phone} onChange={v => setField("phone", v)} placeholder="+225 07 XX XX XX" t={t} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${t.border}` }}>
              <BtnPrimary onClick={saveProfile} disabled={!pfDirty} loading={pfLoading}>
                {pfLoading ? "Enregistrement..." : "✓ Enregistrer les modifications"}
              </BtnPrimary>
              {pfDirty && (
                <BtnGhost onClick={() => { setPf({ firstname: user.firstname, lastname: user.lastname, phone: user.phoneNumber }); setPfDirty(false); }} t={t}>
                  Annuler
                </BtnGhost>
              )}
            </div>
          </div>

          {/* — Card changement de mot de passe — */}
          <div style={card}>
            <div style={{ marginBottom: "20px" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: t.text, marginBottom: "4px" }}>Changer le mot de passe</div>
              <div style={{ fontSize: "12px", color: t.textMuted }}>Saisissez votre mot de passe actuel pour valider le changement</div>
            </div>

            {/* Bannière info */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "11px 14px", borderRadius: "10px", background: "#5b8def10", border: "1px solid #5b8def25", marginBottom: "18px" }}>
              <span style={{ fontSize: "15px", flexShrink: 0 }}>🔐</span>
              <span style={{ fontSize: "12px", color: "#60a5fa", fontWeight: 500, lineHeight: 1.5 }}>
                Un email de confirmation sera envoyé après le changement. Votre session restera active.
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <FieldLabel t={t}>Mot de passe actuel *</FieldLabel>
                <TextInput type="password" value={pw.current} onChange={v => setPw(p => ({ ...p, current: v }))} placeholder="Votre mot de passe actuel" t={t} />
              </div>

              <div>
                <FieldLabel t={t}>Nouveau mot de passe *</FieldLabel>
                <TextInput type="password" value={pw.next} onChange={v => setPw(p => ({ ...p, next: v }))} placeholder="Choisissez un nouveau mot de passe" t={t} />
                <StrengthBar password={pw.next} t={t} />
              </div>

              <div>
                <FieldLabel t={t}>Confirmer le nouveau mot de passe *</FieldLabel>
                <TextInput type="password" value={pw.confirm} onChange={v => setPw(p => ({ ...p, confirm: v }))} placeholder="Répétez le nouveau mot de passe" t={t} />
                {pw.confirm.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "7px", fontSize: "11px", fontWeight: 700, color: pwMatch ? "#4dab8a" : "#d95565" }}>
                    <div style={{ width: 5, height: 5, borderRadius: "50%", background: pwMatch ? "#4dab8a" : "#d95565" }} />
                    {pwMatch ? "Les mots de passe correspondent" : "Les mots de passe ne correspondent pas"}
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: "20px", paddingTop: "20px", borderTop: `1px solid ${t.border}` }}>
              <BtnPrimary onClick={changePassword} disabled={!pwCanSubmit} loading={pwLoading}>
                {pwLoading ? "Changement en cours..." : "🔑 Changer le mot de passe"}
              </BtnPrimary>
            </div>
          </div>

          {/* — Card zone de danger — */}
          <div style={{ ...card, border: `1px solid #d9556522` }}>
            <div style={{ fontSize: "13px", fontWeight: 800, color: "#d95565", marginBottom: "16px" }}>
              Zone de danger
            </div>

            <div style={{ background: "#d9556506", border: "1px solid #d955651a", borderRadius: "10px", padding: "16px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: t.text, marginBottom: "4px" }}>
                  Déconnexion de toutes les sessions
                </div>
                <div style={{ fontSize: "12px", color: t.textMuted, lineHeight: 1.5 }}>
                  Révoque tous les tokens actifs sur l'ensemble de vos appareils.
                </div>
              </div>
              <button
                onClick={() => setShowRevokeModal(true)}
                style={{
                  padding: "9px 18px", borderRadius: "9px", flexShrink: 0,
                  border: "1px solid #d9556544", background: "#d9556512",
                  color: "#d95565", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Révoquer tout
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── Toast ── */}
      {toast && <Toast msg={toast.msg} ok={toast.ok} onDone={() => setToast(null)} />}

      {/* ── Confirm Deletion ── */}
      <ConfirmModal
        isOpen={showRevokeModal}
        onClose={() => setShowRevokeModal(false)}
        onConfirm={revokeAll}
        title="Révoquer toutes les sessions ?"
        message="Cette action déconnectera tous vos appareils actifs. Vous devrez vous reconnecter partout."
        confirmText="Révoquer tout"
        cancelText="Annuler"
        variant="danger"
      />
    </div>
  );
}
