"use client";

/**
 * src/components/dashboard/AdminPanel.tsx
 * ───────────────────────────────────────
 * Panel complet avec :
 * - Gestion Utilisateurs (CRUD + Toggle status + Log Histoire)
 * - Gestion Profils (CRUD + Permissions)
 * - Journal d'Audit
 */

import { useState, useEffect, useMemo } from "react";
import { useTokens } from "@/hooks/use-tokens";
import { useAppStore } from "@/store/use-app-store";
import { setPauseAutoRefresh } from "@/app/(dashboard)/layout";
import {
  Users, Shield, Settings, History, Search, Plus,
  Edit2, Trash2, Power, Eye, Check, X,
  ChevronRight, ArrowLeft, Loader2, MoreVertical,
  Calendar, Clock, ShieldCheck, Mail, Phone, User as UserIcon, MessageCircle
} from "lucide-react";
import { AlertSettingsPanel } from "./AlertSettingsPanel";
import type { User, Profile, AdminSection, IPaginationResult } from "@/types";
import { ConfirmModal } from "@/shared/components/molecules/ConfirmModal";
import { apiFetch } from "@/lib/api-client";
import { Pagination, PaginationMeta } from "@/shared/components/molecules/Pagination";

// ─── ATOMS (REUSED FROM PROFILE) ─────────────────────────────────────────────

function FieldLabel({ children, t }: { children: React.ReactNode; t: any }) {
  return (
    <label style={{
      display: "block", marginBottom: "6px",
      fontSize: "13px", fontWeight: 700, color: t.textFaint,
      letterSpacing: "0.1em", textTransform: "uppercase" as const,
    }}>
      {children}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder = "", readOnly = false,
  type = "text", t, icon: Icon,
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  readOnly?: boolean; type?: string; t: any; icon?: any;
}) {
  return (
    <div style={{ position: "relative" }}>
      {Icon && <Icon size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: t.textFaint }} />}
      <input
        type={type}
        value={value}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        style={{
          width: "100%",
          padding: "11px 14px",
          paddingLeft: Icon ? "38px" : "14px",
          borderRadius: "10px",
          border: `1px solid ${t.borderMid}`,
          background: readOnly ? t.surfaceAlt : t.surface,
          color: readOnly ? t.textMuted : t.text,
          fontSize: "16px",
          outline: "none",
          fontFamily: "inherit",
          cursor: readOnly ? "not-allowed" : "text",
          transition: "all 0.15s",
        }}
        onFocus={e => e.currentTarget.style.borderColor = "#5b8def"}
        onBlur={e => e.currentTarget.style.borderColor = t.borderMid}
      />
    </div>
  );
}

// ─── USER FORM (PREMIUM) ─────────────────────────────────────────────────────

function UserForm({ user, profiles, onClose, onSuccess, t, dark }: any) {
  useEffect(() => {
    setPauseAutoRefresh(true);
    return () => setPauseAutoRefresh(false);
  }, []);

  const [formData, setFormData] = useState({
    firstname: user?.firstname || "",
    lastname: user?.lastname || "",
    email: user?.email || "",
    phoneNumber: user?.phoneNumber || "",
    profileId: user?.profileId || (profiles[0]?.id || 1),
    status: user?.active ? "ACTIVE" : "INACTIVE"
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = user ? `/api/users/${user.id}` : "/api/users";
      const method = user ? "PUT" : "POST";
      
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user ? {
          firstname: formData.firstname,
          lastname: formData.lastname,
          phoneNumber: formData.phoneNumber,
          profileId: Number(formData.profileId),
          status: formData.status
        } : {
          firstname: formData.firstname,
          lastname: formData.lastname,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          profileId: Number(formData.profileId)
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur lors de l'enregistrement");
      }
      onSuccess(user ? "Utilisateur mis à jour" : "Utilisateur créé");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {error && (
        <div style={{ padding: "12px", borderRadius: "8px", background: "#d9556515", color: "#d95565", fontSize: "13px", fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div>
          <FieldLabel t={t}>Prénom</FieldLabel>
          <TextInput t={t} icon={UserIcon} value={formData.firstname} onChange={v => setFormData({ ...formData, firstname: v })} placeholder="ex: Jean" />
        </div>
        <div>
          <FieldLabel t={t}>Nom</FieldLabel>
          <TextInput t={t} icon={UserIcon} value={formData.lastname} onChange={v => setFormData({ ...formData, lastname: v })} placeholder="ex: Kouassi" />
        </div>
      </div>

      <div>
        <FieldLabel t={t}>Email</FieldLabel>
        <TextInput t={t} icon={Mail} value={formData.email} onChange={v => setFormData({ ...formData, email: v })} placeholder="email@exemple.com" readOnly={!!user} />
      </div>

      <div>
        <FieldLabel t={t}>Téléphone</FieldLabel>
        <TextInput t={t} icon={Phone} value={formData.phoneNumber} onChange={v => setFormData({ ...formData, phoneNumber: v })} placeholder="+225 ..." />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div>
          <FieldLabel t={t}>Profil / Rôle</FieldLabel>
          <select 
            value={formData.profileId} 
            onChange={e => setFormData({ ...formData, profileId: e.target.value })}
            style={{
              width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${t.borderMid}`,
              background: t.surface, color: t.text, fontSize: "14px", outline: "none"
            }}
          >
            {profiles.map((p: any) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
        {user && (
          <div>
            <FieldLabel t={t}>Statut</FieldLabel>
            <select 
              value={formData.status} 
              onChange={e => setFormData({ ...formData, status: e.target.value })}
              style={{
                width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${t.borderMid}`,
                background: t.surface, color: t.text, fontSize: "14px", outline: "none"
              }}
            >
              <option value="ACTIVE">Actif</option>
              <option value="INACTIVE">Désactivé</option>
              <option value="BLOCKED">Bloqué</option>
            </select>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: `1px solid ${t.borderMid}`, background: "none", color: t.text, fontWeight: 700, cursor: "pointer" }}>
          Annuler
        </button>
        <button type="submit" disabled={saving} style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: "#5b8def", color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          {saving ? <Loader2 className="animate-spin" size={18} /> : (user ? "Enregistrer" : "Créer l'utilisateur")}
        </button>
      </div>
    </form>
  );
}

// ─── PROFILE FORM (PREMIUM) ──────────────────────────────────────────────────

// ─── SERVER FORM (PREMIUM) ───────────────────────────────────────────────────

function ServerForm({ server, onClose, onSuccess, t, dark }: any) {
  // Pause auto-refresh while the form is open
  useEffect(() => {
    setPauseAutoRefresh(true);
    return () => setPauseAutoRefresh(false);
  }, []);

  const [formData, setFormData] = useState({
    name:        server?.name || "",
    ip:          server?.ip || "",
    agentPort:   server?.agentPort || 9101,
    environment: server?.environment || "Dev",
    provider:    server?.provider || "OVH",
    agentActive: server?.agentActive ?? false,
    agentToken:  server?.agentToken || "",
    description: server?.description || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const isEdit = !!server?.id;
      const url = isEdit ? `/api/servers/${server.id}` : "/api/servers";
      const method = isEdit ? "PUT" : "POST";
      
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur lors de l'enregistrement");
      }
      onSuccess(server ? "Serveur mis à jour" : "Serveur créé");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {error && (
        <div style={{ padding: "12px", borderRadius: "8px", background: "#d9556515", color: "#d95565", fontSize: "13px", fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div>
          <FieldLabel t={t}>Nom du serveur</FieldLabel>
          <TextInput t={t} icon={Settings} value={formData.name} onChange={v => setFormData({ ...formData, name: v })} placeholder="ex: STAGING-DB" />
        </div>
        <div>
          <FieldLabel t={t}>Adresse IP</FieldLabel>
          <TextInput t={t} icon={Power} value={formData.ip} onChange={v => setFormData({ ...formData, ip: v })} placeholder="0.0.0.0" readOnly={!!server} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div>
          <FieldLabel t={t}>Port Agent</FieldLabel>
          <TextInput t={t} type="number" value={formData.agentPort.toString()} onChange={v => setFormData({ ...formData, agentPort: parseInt(v) || 9101 })} placeholder="9101" />
        </div>
        <div>
          <FieldLabel t={t}>Token d'authentification</FieldLabel>
          <TextInput t={t} type="password" value={formData.agentToken} onChange={v => setFormData({ ...formData, agentToken: v })} placeholder="secret-token..." />
        </div>
      </div>
      <div>
          <FieldLabel t={t}>Statut Agent</FieldLabel>
          <div style={{ display: "flex", gap: "10px", alignItems: "center", height: "46px" }}>
            <button
              type="button"
              onClick={() => setFormData({ ...formData, agentActive: !formData.agentActive })}
              style={{
                padding: "8px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 700,
                cursor: "pointer", transition: "all 0.15s",
                border: "none",
                background: formData.agentActive ? "#4dab8a" : t.border,
                color: formData.agentActive ? "#fff" : t.textMuted
              }}
            >
              {formData.agentActive ? "🟢 Agent Actif" : "🔴 Agent Inactif"}
            </button>
          </div>
        </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <div>
          <FieldLabel t={t}>Environnement</FieldLabel>
          <select value={formData.environment} onChange={e => setFormData({ ...formData, environment: e.target.value })} style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${t.borderMid}`, background: t.surface, color: t.text, fontSize: "14px", outline: "none" }}>
            {["Dev", "Demo", "Pilote", "Prod", "Backup"].map(ev => <option key={ev} value={ev}>{ev}</option>)}
          </select>
        </div>
        <div>
          <FieldLabel t={t}>Hébergeur</FieldLabel>
          <select value={formData.provider} onChange={e => setFormData({ ...formData, provider: e.target.value })} style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${t.borderMid}`, background: t.surface, color: t.text, fontSize: "14px", outline: "none" }}>
            {["OVH", "Azure", "AWS"].map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <div>
        <FieldLabel t={t}>Description</FieldLabel>
        <TextInput t={t} icon={MoreVertical} value={formData.description} onChange={v => setFormData({ ...formData, description: v })} placeholder="Rôle du serveur..." />
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: `1px solid ${t.borderMid}`, background: "none", color: t.text, fontWeight: 700, cursor: "pointer" }}>
          Annuler
        </button>
        <button type="submit" disabled={saving} style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: "#5b8def", color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          {saving ? <Loader2 className="animate-spin" size={18} /> : (server ? "Mettre à jour" : "Créer le serveur")}
        </button>
      </div>
    </form>
  );
}

function ProfileForm({ profile, onClose, onSuccess, t, dark }: any) {
  useEffect(() => {
    setPauseAutoRefresh(true);
    return () => setPauseAutoRefresh(false);
  }, []);

  const [formData, setFormData] = useState({
    libelle: profile?.label || profile?.libelle || "",
    description: profile?.description || "",
    permissions: profile?.permissions || ["Lecture"]
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const allPermissions = ["Lecture", "Ecriture", "Administration", "Audit", "Serveurs"];

  const togglePermission = (p: string) => {
    if (formData.permissions.includes(p)) {
      setFormData({ ...formData, permissions: formData.permissions.filter((x: string) => x !== p) });
    } else {
      setFormData({ ...formData, permissions: [...formData.permissions, p] });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const url = profile ? `/api/admin/profiles/${profile.id}` : "/api/admin/profiles";
      const method = profile ? "PUT" : "POST";
      
      const res = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          libelle: formData.libelle,
          description: formData.description,
          permissions: formData.permissions
        })
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Erreur lors de l'enregistrement");
      }
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {error && (
        <div style={{ padding: "12px", borderRadius: "8px", background: "#d9556515", color: "#d95565", fontSize: "13px", fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div>
        <FieldLabel t={t}>Libellé du profil</FieldLabel>
        <TextInput t={t} icon={Shield} value={formData.libelle} onChange={v => setFormData({ ...formData, libelle: v })} placeholder="ex: Superviseur" />
      </div>

      <div>
        <FieldLabel t={t}>Description</FieldLabel>
        <textarea 
          value={formData.description}
          onChange={e => setFormData({ ...formData, description: e.target.value })}
          placeholder="Brève description des responsabilités..."
          style={{
            width: "100%", padding: "11px 14px", borderRadius: "10px", border: `1px solid ${t.borderMid}`,
            background: t.surface, color: t.text, fontSize: "14px", outline: "none", minHeight: "80px", fontFamily: "inherit"
          }}
        />
      </div>

      <div>
        <FieldLabel t={t}>Permissions</FieldLabel>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {allPermissions.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => togglePermission(p)}
              style={{
                padding: "6px 12px", borderRadius: "8px", fontSize: "12px", fontWeight: 700,
                cursor: "pointer", border: `1px solid ${formData.permissions.includes(p) ? "#5b8def" : t.borderMid}`,
                background: formData.permissions.includes(p) ? "#5b8def15" : t.surfaceAlt,
                color: formData.permissions.includes(p) ? "#5b8def" : t.textMuted,
                transition: "all 0.15s"
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
        <button type="button" onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: `1px solid ${t.borderMid}`, background: "none", color: t.text, fontWeight: 700, cursor: "pointer" }}>
          Annuler
        </button>
        <button type="submit" disabled={saving} style={{ flex: 2, padding: "12px", borderRadius: "10px", border: "none", background: "#5b8def", color: "#fff", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          {saving ? <Loader2 className="animate-spin" size={18} /> : (profile ? "Enregistrer" : "Créer le profil")}
        </button>
      </div>
    </form>
  );
}

// ─── ADMIN PANEL COMPONENT ───────────────────────────────────────────────────

export function AdminPanel({ users: initialUsers, profiles: initialProfiles }: { users?: IPaginationResult<User>, profiles?: IPaginationResult<Profile> }) {
  const dark = useAppStore((s) => s.dark);
  const showToast = useAppStore((s) => s.showToast);
  const t = useTokens(dark);

  const [activeSection, setActiveSection] = useState<AdminSection>("users");
  const [users, setUsers] = useState<User[]>(initialUsers?.data || []);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles?.data || []);
  const [servers, setServers] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(!initialUsers);
  const [syncing, setSyncing] = useState(false);

  // Pagination metadata states
  const [userMeta, setUserMeta] = useState<PaginationMeta | null>((initialUsers?.metadata as any) || { totalItems: 0, itemCount: 0, itemsPerPage: 10, totalPages: 1, currentPage: 1, nextPage: null, previousPage: null });
  const [profileMeta, setProfileMeta] = useState<PaginationMeta | null>((initialProfiles?.metadata as any) || { totalItems: 0, itemCount: 0, itemsPerPage: 10, totalPages: 1, currentPage: 1, nextPage: null, previousPage: null });
  const [serverMeta, setServerMeta] = useState<PaginationMeta | null>(null);
  const [auditMeta, setAuditMeta] = useState<PaginationMeta | null>(null);

  // Current pages & limits
  const [userPage, setUserPage] = useState(1);
  const [userLimit, setUserLimit] = useState(10);
  const [profilePage, setProfilePage] = useState(1);
  const [profileLimit, setProfileLimit] = useState(10);
  const [serverPage, setServerPage] = useState(1);
  const [serverLimit, setServerLimit] = useState(10);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit, setAuditLimit] = useState(10);

  // Form states
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [showServerModal, setShowServerModal] = useState(false);
  const [editingServer, setEditingServer] = useState<any | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [profileToDelete, setProfileToDelete] = useState<number | null>(null);
  const [serverToDelete, setServerToDelete] = useState<any | null>(null);
  // Search
  const [search, setSearch] = useState("");

  // History Detail
  const [historyData, setHistoryData] = useState<{ loginHistory: any[], auditLogs: any[] } | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (showHistoryModal) {
      fetchUserHistory(showHistoryModal.id);
    } else {
      setHistoryData(null);
    }
  }, [showHistoryModal]);

  const fetchUserHistory = async (userId: number) => {
    setLoadingHistory(true);
    try {
      const res = await apiFetch(`/api/users/${userId}/history?all=true`);
      if (res.ok) {
        const json = await res.json();
        setHistoryData({
          loginHistory: json.loginHistory.data,
          auditLogs: json.auditLogs.data
        });
      }
    } catch (e) { console.error(e); }
    finally { setLoadingHistory(false); }
  };

  useEffect(() => {
    if (!initialUsers && (activeSection === "users" || activeSection === "infrastructure")) {
      fetchData();
    }
  }, [initialUsers]);

  // Track if we've already done the initial load to skip the first activeSection effect call
  const [isFirstRender, setIsFirstRender] = useState(true);

  useEffect(() => {
    if (activeSection === "logs") {
      const fetchLogs = async () => {
        try {
          const res = await apiFetch(`/api/admin/audit?page=${auditPage}&limit=${auditLimit}`);
          if (res.ok) {
            const json = await res.json();
            setAuditLogs(json.data);
            setAuditMeta(json.metadata);
          }
        } catch (e) {}
      };
      fetchLogs();
    }
    
    // Refresh data when section OR page changes
    if (!isFirstRender) {
      if (activeSection === "infrastructure" || activeSection === "users" || activeSection === "profiles" || activeSection === "logs") {
        fetchData();
      }
    }
    setIsFirstRender(false);
  }, [activeSection, userPage, userLimit, profilePage, profileLimit, serverPage, serverLimit, auditPage, auditLimit]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dataRes, aRes, sRes] = await Promise.all([
        apiFetch(`/api/admin/data?userPage=${userPage}&userLimit=${userLimit}&profilePage=${profilePage}&profileLimit=${profileLimit}`),
        apiFetch(`/api/admin/audit?page=${auditPage}&limit=${auditLimit}`),
        apiFetch(`/api/servers?page=${serverPage}&limit=${serverLimit}`)
      ]);
      
      if (dataRes.ok) {
        const json = await dataRes.json();
        // admin/data returns users and profiles. We might need to check its implementation.
        // For now, assuming it returns { users: {data, meta}, profiles: {data, meta} }
        setUsers(json.users.data || json.users); 
        setProfiles(json.profiles.data || json.profiles);
        setUserMeta(json.users.metadata);
        setProfileMeta(json.profiles.metadata);
      }
      if (aRes.ok) {
        const json = await aRes.json();
        setAuditLogs(json.data);
        setAuditMeta(json.metadata);
      }
      if (sRes.ok) {
        const json = await sRes.json();
        setServers(json.data);
        setServerMeta(json.metadata);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleGlobalSync = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch("/api/admin/servers/sync", { method: "POST" });
      const data = await res.json();
      showToast(data.message || "Synchronisation terminée");
      fetchData();
    } catch (e) {
      showToast("Erreur lors de la synchronisation", "error");
    } finally {
      setSyncing(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  // -- Actions Utilisateurs --
  const toggleUserStatus = async (user: User) => {
    const nextActive = !user.active;
    try {
      const res = await apiFetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextActive ? "ACTIVE" : "INACTIVE" })
      });
      if (res.ok) {
        setUsers(users.map(u => u.id === user.id ? { ...u, active: nextActive } : u));
        showToast(nextActive ? "Utilisateur activé" : "Utilisateur désactivé");
      } else {
        showToast("Erreur lors du changement de statut", "error");
      }
    } catch (e) { }
  };

  const deleteUser = async () => {
    if (userToDelete === null) return;
    try {
      const res = await apiFetch(`/api/users/${userToDelete}`, { method: "DELETE" });
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userToDelete));
        showToast("Utilisateur supprimé");
      } else {
        showToast("Erreur lors de la suppression", "error");
      }
    } catch (e) { }
    finally { setUserToDelete(null); }
  };

  const deleteProfile = async () => {
    if (profileToDelete === null) return;
    try {
      const res = await apiFetch(`/api/admin/profiles/${profileToDelete}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error || "Erreur lors de la suppression", "error");
        return;
      }
      setProfiles(profiles.filter(p => p.id !== profileToDelete));
      showToast("Profil supprimé");
    } catch (e) { }
    finally { setProfileToDelete(null); }
  };

  // -- Composants UI réutilisables --
  const Card = ({ children, style }: any) => (
    <div style={{
      background: t.surfaceAlt, border: `1px solid ${t.border}`,
      borderRadius: "14px", padding: "20px", ...style
    }}>
      {children}
    </div>
  );

  const Modal = ({ title, onClose, children }: any) => (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1000,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: "20px"
    }} onClick={onClose}>
      <div style={{
        background: t.surface, border: `1px solid ${t.borderMid}`,
        borderRadius: "16px", width: "100%", maxWidth: "500px",
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: "20px 24px", borderBottom: `1px solid ${t.border}`,
          display: "flex", justifyContent: "space-between", alignItems: "center"
        }}>
          <h3 style={{ fontSize: "18px", fontWeight: 800 }}>{title}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted }}><X size={20} /></button>
        </div>
        <div style={{ padding: "24px" }}>{children}</div>
      </div>
    </div>
  );

  return (
    <div style={{ animation: "fade-in 0.4s ease-out" }}>
      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .tab-btn { transition: all 0.2s; border: 1px solid transparent; }
        .tab-btn:hover { background: ${t.surfaceAlt}; }
        .row:hover { background: ${dark ? "rgba(59,130,246,0.03)" : "rgba(59,130,246,0.02)"}; }
      `}</style>

      {/* Header Panel */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: "6px" }}>Administration</h1>
          <p style={{ color: t.textMuted, fontSize: "14px" }}>Gérez les accès, profils et journaux système de NebulOps.</p>
        </div>
        <div style={{
          display: "flex", background: t.surfaceAlt, padding: "4px", borderRadius: "12px", border: `1px solid ${t.border}`
        }}>
          {[
            { id: "users", label: "Utilisateurs", icon: Users },
            { id: "profiles", label: "Profils/Rôles", icon: Shield },
            { id: "infrastructure", label: "Environnement", icon: Settings },
            { id: "logs", label: "Journal Audit", icon: History },
            { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
          ].map(s => (
            <button key={s.id}
              onClick={() => setActiveSection(s.id as AdminSection)}
              className="tab-btn"
              style={{
                display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px",
                borderRadius: "9px", border: "none", cursor: "pointer",
                background: activeSection === s.id ? t.surface : "transparent",
                color: activeSection === s.id ? t.text : t.textMuted,
                boxShadow: activeSection === s.id ? `0 2px 8px ${dark ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.05)"}` : "none",
                fontSize: "13px", fontWeight: activeSection === s.id ? 700 : 500,
              }}>
              <s.icon size={15} color={activeSection === s.id ? "#5b8def" : "currentColor"} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div style={{ height: "400px", display: "flex", alignItems: "center", justifyContent: "center", color: t.textMuted }}>
          <Loader2 className="animate-spin" size={32} />
        </div>
      ) : (
        <>
          {/* ────── SECTION USERS ────── */}
          {activeSection === "users" && (
            <div style={{ animation: "fade-in 0.3s" }}>
              <div style={{ display: "flex", gap: "16px", marginBottom: "20px" }}>
                <div style={{ position: "relative", flex: 1 }}>
                  <Search style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: t.textFaint }} size={16} />
                  <input
                    type="text" placeholder="Rechercher email, nom..."
                    value={search} onChange={e => setSearch(e.target.value)}
                    style={{
                      width: "100%", padding: "10px 10px 10px 40px", borderRadius: "10px",
                      background: t.surfaceAlt, border: `1px solid ${t.border}`, color: t.text, outline: "none"
                    }}
                  />
                </div>
                <button
                  onClick={() => { setEditingUser(null); setShowUserModal(true); }}
                  style={{
                    padding: "0 20px", borderRadius: "10px", border: "none", background: "#5b8def", color: "#fff",
                    fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
                  }}>
                  <Plus size={18} /> Nouveau
                </button>
              </div>

              <Card style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: dark ? "rgba(255,255,255,0.02)" : "#fafafa", borderBottom: `1px solid ${t.border}` }}>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Utilisateur</th>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Profil</th>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Staut</th>
                      <th style={{ textAlign: "right", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr key={u.id} className="row" style={{ borderBottom: `1px solid ${t.border}` }}>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#5b8def20", color: "#5b8def", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12px" }}>
                              {u.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700 }}>{u.name}</div>
                              <div style={{ fontSize: "12px", color: t.textMuted }}>{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: t.border, color: t.textMuted }}>
                            {u.role || "Collaborateur"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: u.active ? "#4dab8a" : "#d95565" }} />
                            <span style={{ fontSize: "12px", fontWeight: 600, color: u.active ? "#4dab8a" : "#d95565" }}>
                              {u.active ? "Actif" : "Désactivé"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                            <button onClick={() => setShowHistoryModal(u)} title="Historique" style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: t.textMuted }}><History size={16} /></button>
                            <button onClick={() => { setEditingUser(u); setShowUserModal(true); }} title="Éditer" style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: t.textMuted }}><Edit2 size={16} /></button>
                            <button onClick={() => toggleUserStatus(u)} title={u.active ? "Désactiver" : "Activer"} style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: u.active ? "#d95565" : "#4dab8a" }}>
                              <Power size={16} />
                            </button>
                            <button onClick={() => setUserToDelete(u.id)} title="Supprimer" style={{ padding: 8, background: "none", border: "none", cursor: "pointer", color: "#d95565" }}><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Pagination meta={userMeta} onPageChange={setUserPage} onLimitChange={setUserLimit} t={t} />
            </div>
          )}

          {/* ────── SECTION PROFILS ────── */}
          {activeSection === "profiles" && (
            <div style={{ animation: "fade-in 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <div style={{ color: t.textMuted, fontSize: "14px" }}>Gérez les types d'accès et leurs permissions granulaires.</div>
                <button
                  onClick={() => { setEditingProfile(null); setShowProfileModal(true); }}
                  style={{
                    padding: "10px 20px", borderRadius: "10px", border: "none", background: "#5b8def", color: "#fff",
                    fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
                  }}>
                  <Plus size={18} /> Créer un profil
                </button>
              </div>
              <div style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", display: "grid", gap: "20px" }}>
                {profiles.map(p => (
                  <Card key={p.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#5b8def15", display: "flex", alignItems: "center", justifyContent: "center", color: "#5b8def" }}>
                        <Shield size={22} />
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => { setEditingProfile(p); setShowProfileModal(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted }}><Edit2 size={16} /></button>
                        <button onClick={() => setProfileToDelete(p.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#d95565" }}><Trash2 size={16} /></button>
                      </div>
                    </div>
                    <div style={{ fontSize: "18px", fontWeight: 800, marginBottom: "4px" }}>{p.label || p.libelle}</div>
                    <div style={{ fontSize: "12px", color: t.textMuted, marginBottom: "20px" }}>{p.description || "Pas de description."}</div>
                    <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: "16px" }}>
                      <div style={{ fontSize: "11px", fontWeight: 800, color: t.textFaint, textTransform: "uppercase", marginBottom: "10px" }}>Permissions</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {p.permissions?.map(pm => (
                          <div key={pm} style={{ fontSize: "10px", fontWeight: 700, padding: "4px 8px", borderRadius: "6px", background: dark ? "#1e293b" : "#f1f5f9", color: t.textMuted }}>
                            {pm}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              <Pagination meta={profileMeta} onPageChange={setProfilePage} onLimitChange={setProfileLimit} t={t} />
            </div>
          )}

          {/* ────── SECTION INFRASTRUCTURE ────── */}
          {activeSection === "infrastructure" && (
            <div style={{ animation: "fade-in 0.3s" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
                <div style={{ color: t.textMuted, fontSize: "14px" }}>Configurez vos serveurs et activez l'agent pour la remontée de métriques.</div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button
                    onClick={handleGlobalSync}
                    disabled={syncing}
                    style={{
                      padding: "10px 20px", borderRadius: "10px", border: `1px solid ${t.borderMid}`, background: t.surface, color: t.text,
                      fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
                    }}>
                    {syncing ? <Loader2 className="animate-spin" size={18} /> : <span>🔄 Synchroniser</span>}
                  </button>
                  <button
                    onClick={() => { setEditingServer(null); setShowServerModal(true); }}
                    style={{
                      padding: "10px 20px", borderRadius: "10px", border: "none", background: "#5b8def", color: "#fff",
                      fontWeight: 700, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px"
                    }}>
                    <Plus size={18} /> Ajouter un serveur
                  </button>
                </div>
              </div>
              
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: dark ? "rgba(255,255,255,0.02)" : "#fafafa", borderBottom: `1px solid ${t.border}` }}>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Serveur</th>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>IP:Port</th>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Environnement</th>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Agent</th>
                      <th style={{ textAlign: "right", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servers.map(s => (
                      <tr key={s.id} className="row" style={{ borderBottom: `1px solid ${t.border}` }}>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ fontWeight: 700 }}>{s.name}</div>
                          <div style={{ fontSize: "12px", color: t.textMuted }}>{s.provider}</div>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <span style={{ fontFamily: "monospace", fontSize: "12px", background: t.surface, padding: "2px 6px", borderRadius: "4px" }}>
                            {s.ip}:{s.agentPort}
                          </span>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <span style={{ fontSize: "12px", fontWeight: 700, padding: "2px 8px", borderRadius: "6px", background: "#5b8def15", color: "#5b8def" }}>
                            {s.environment}
                          </span>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: s.agentActive ? "#4dab8a" : t.borderMid }} />
                            <span style={{ fontSize: "12px", fontWeight: 600, color: s.agentActive ? "#4dab8a" : t.textFaint }}>
                              {s.agentActive ? "Actif" : "Inactif"}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px", textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <button onClick={() => { setEditingServer(s); setShowServerModal(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted }}><Edit2 size={16} /></button>
                            <button 
                              onClick={() => setServerToDelete(s)} 
                              style={{ background: "none", border: "none", cursor: "pointer", color: "#d95565" }}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {servers.length === 0 && (
                      <tr><td colSpan={5} style={{ padding: "40px", textAlign: "center", color: t.textMuted }}>Aucun serveur configuré.</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
              <Pagination meta={serverMeta} onPageChange={setServerPage} onLimitChange={setServerLimit} t={t} />
            </div>
          )}
          {activeSection === "logs" && (
            <div style={{ animation: "fade-in 0.3s" }}>
              <Card style={{ padding: 0, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                  <thead>
                    <tr style={{ background: dark ? "rgba(255,255,255,0.02)" : "#fafafa", borderBottom: `1px solid ${t.border}` }}>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Date/Heure</th>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Acteur</th>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>Action</th>
                      <th style={{ textAlign: "left", padding: "14px 20px", color: t.textMuted, fontSize: "11px", textTransform: "uppercase", fontWeight: 800 }}>IP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log, idx) => (
                      <tr key={idx} className="row" style={{ borderBottom: `1px solid ${t.border}` }}>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <Calendar size={13} color={t.textFaint} />
                            <span style={{ fontSize: "12px", color: t.textMuted }}>{new Date(log.createdAt).toLocaleDateString()}</span>
                            <Clock size={13} color={t.textFaint} style={{ marginLeft: "4px" }} />
                            <span style={{ fontSize: "12px", color: t.textMuted }}>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <div style={{ fontWeight: 600 }}>{log.actorEmail}</div>
                        </td>
                        <td style={{ padding: "14px 20px" }}>
                          <span style={{
                            fontSize: "12px", fontWeight: 600, padding: "2px 8px", borderRadius: 6,
                            color: log.action.includes("DELETE") ? "#d95565" : log.action.includes("CREATE") ? "#4dab8a" : "#5b8def"
                          }}>
                            {log.action}
                          </span>
                        </td>
                        <td style={{ padding: "14px 20px", fontSize: "12px", color: t.textFaint, fontFamily: "monospace" }}>{log.ip || "--"}</td>
                      </tr>
                    ))}
                    {auditLogs.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: "40px", textAlign: "center", color: t.textMuted }}>Aucun journal d'audit disponible.</td></tr>
                    )}
                  </tbody>
                </table>
              </Card>
              <Pagination meta={auditMeta} onPageChange={setAuditPage} onLimitChange={setAuditLimit} t={t} />
            </div>
          )}

          {/* ────── SECTION WHATSAPP ────── */}
          {activeSection === "whatsapp" && (
            <div style={{ animation: "fade-in 0.3s" }}>
              <AlertSettingsPanel dark={dark} />
            </div>
          )}
        </>
      )}

      {/* ────── MODAL UTILISATEUR (Add/Edit) ────── */}
      {showUserModal && (
        <Modal
          title={editingUser ? "Modifier l'utilisateur" : "Ajouter un utilisateur"}
          onClose={() => setShowUserModal(false)}
        >
          <UserForm
            user={editingUser}
            profiles={profiles}
            onClose={() => setShowUserModal(false)}
            onSuccess={(msg: string) => { setShowUserModal(false); showToast(msg); fetchData(); }}
            t={t}
            dark={dark}
          />
        </Modal>
      )}
      {/* ────── MODAL HISTORIQUE ────── */}
      {showHistoryModal && (
        <Modal title={`Historique : ${showHistoryModal.name}`} onClose={() => setShowHistoryModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {loadingHistory ? (
              <div style={{ padding: "40px", textAlign: "center", color: t.textMuted }}><Loader2 className="animate-spin" /></div>
            ) : (
              <>
                <div style={{ display: "flex", gap: "16px" }}>
                  <Card style={{ flex: 1, textAlign: "center", padding: "16px", background: "#5b8def08" }}>
                    <div style={{ fontSize: "24px", fontWeight: 900, color: "#5b8def" }}>{historyData?.loginHistory.length || 0}</div>
                    <div style={{ fontSize: "11px", color: t.textMuted, fontWeight: 700 }}>Connexions</div>
                  </Card>
                  <Card style={{ flex: 1, textAlign: "center", padding: "16px", background: "#d9556508" }}>
                    <div style={{ fontSize: "24px", fontWeight: 900, color: "#d95565" }}>{historyData?.auditLogs.length || 0}</div>
                    <div style={{ fontSize: "11px", color: t.textMuted, fontWeight: 700 }}>Activité</div>
                  </Card>
                </div>

                <div style={{ maxHeight: "400px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "12px", paddingRight: "4px" }}>
                  <h4 style={{ fontSize: "12px", fontWeight: 800, color: t.textFaint, textTransform: "uppercase" }}>Dernières Connexions</h4>
                  {historyData?.loginHistory.map((h, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderRadius: "10px", background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700 }}>{h.ipAddress || "Inconnu"}</div>
                        <div style={{ fontSize: "11px", color: t.textMuted }}>{h.browser || "Agent inconnu"} • {new Date(h.connectedAt).toLocaleString()}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "11px", fontWeight: 700, color: h.disconnectedAt ? t.textMuted : "#4dab8a" }}>
                          {h.disconnectedAt ? "Déconnecté" : "En cours"}
                        </div>
                      </div>
                    </div>
                  ))}
                  <h4 style={{ fontSize: "12px", fontWeight: 800, color: t.textFaint, textTransform: "uppercase", marginTop: "12px" }}>Dernières Actions</h4>
                  {historyData?.auditLogs.map((a, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderRadius: "10px", background: t.surfaceAlt, border: `1px solid ${t.border}` }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 700, color: "#5b8def" }}>{a.action}</div>
                        <div style={{ fontSize: "11px", color: t.textMuted }}>Cible: {a.target} • {new Date(a.createdAt).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {historyData?.auditLogs.length === 0 && <div style={{ fontSize: "12px", color: t.textMuted, textAlign: "center", padding: "20px" }}>Aucune action répertoriée.</div>}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* ────── MODAL PROFIL (Add/Edit) ────── */}
      {showProfileModal && (
        <Modal title={editingProfile ? "Éditer le profil" : "Nouveau profil"} onClose={() => setShowProfileModal(false)}>
          <ProfileForm 
            profile={editingProfile} 
            t={t} dark={dark}
            onClose={() => setShowProfileModal(false)} 
            onSuccess={(msg: string) => { setShowProfileModal(false); showToast(msg); fetchData(); }} 
          />
        </Modal>
      )}

      {/* ────── MODAL SERVEUR (Add/Edit) ────── */}
      {showServerModal && (
        <Modal 
          title={editingServer ? "Modifier le serveur" : "Ajouter un serveur"} 
          onClose={() => setShowServerModal(false)}
        >
          <ServerForm
            server={editingServer}
            onClose={() => setShowServerModal(false)}
            onSuccess={(msg: string) => { setShowServerModal(false); showToast(msg); fetchData(); }}
            t={t}
            dark={dark}
          />
        </Modal>
      )}

      {/* ────── MODALS DE CONFIRMATION ────── */}
      <ConfirmModal
        isOpen={userToDelete !== null}
        onClose={() => setUserToDelete(null)}
        onConfirm={deleteUser}
        title="Supprimer l'utilisateur ?"
        message="Cette action est irréversible. Toutes les données liées à cet utilisateur seront supprimées."
        confirmText="Supprimer"
      />

      <ConfirmModal
        isOpen={profileToDelete !== null}
        onClose={() => setProfileToDelete(null)}
        onConfirm={deleteProfile}
        title="Supprimer le profil ?"
        message="Attention: Cela pourrait affecter les utilisateurs associés. Voulez-vous continuer ?"
        confirmText="Supprimer"
      />

      <ConfirmModal
        isOpen={serverToDelete !== null}
        onClose={() => setServerToDelete(null)}
        onConfirm={async () => {
          if (serverToDelete) {
            await apiFetch(`/api/servers/${serverToDelete.id}`, { method: "DELETE" });
            setServerToDelete(null);
            fetchData();
            showToast("Serveur supprimé");
          }
        }}
        title="Supprimer le serveur ?"
        message={`Voulez-vous vraiment supprimer le serveur "${serverToDelete?.name}" ?`}
        confirmText="Supprimer"
      />

    </div>
  );
}
