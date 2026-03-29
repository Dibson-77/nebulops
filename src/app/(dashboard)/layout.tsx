"use client";

/**
 * app/(dashboard)/layout.tsx
 * ─────────────────────────────
 * Sidebar enrichie : hébergeurs avec compteurs + sidebar pro
 * Topbar : user réel depuis JWT (cookie parsed côté client)
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useTokens } from "@/hooks/use-tokens";
import { useWebSocket } from "@/hooks/use-websocket";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Toast } from "@/components/ui/Toast";
import { PROVIDER_COLORS, DISK_ALERT_PCT } from "@/lib/constants";
import type { Provider, ThemeTokens } from "@/types";
import { SessionExpiredModal } from "@/shared/components/molecules/SessionExpiredModal";
import { apiFetch } from "@/lib/api-client";
import { NebulOpsLogo } from "@/components/ui/NebulOpsLogo";
import {
  LayoutDashboard, Server, Bell, Settings, LogOut, Sun, Moon, FileText,
} from "lucide-react";

const PROVIDERS: Provider[] = ["OVH", "Azure", "AWS"];

/**
 * Module-level flag to pause auto-sync when a form is open.
 * Lives outside React to avoid triggering re-renders.
 */
let _pauseAutoRefresh = false;
export function setPauseAutoRefresh(v: boolean) { _pauseAutoRefresh = v; }
export function isPauseAutoRefresh() { return _pauseAutoRefresh; }


const NAV_ICONS: Record<string, React.ElementType> = {
  "/dashboard": LayoutDashboard,
  "/servers":   Server,
  "/alerts":    Bell,
  "/logs":      FileText,
  "/admin":     Settings,
};

const NavItem = ({ href, label, badge, pathname, dark, t }: {
  href: string;
  label: string;
  badge?: number;
  pathname: string;
  dark: boolean;
  t: ThemeTokens;
}) => {
  const active = pathname === href || (href !== "/" && pathname.startsWith(href));
  const Icon = NAV_ICONS[href];
  const color = active ? (dark ? "#e2eaf5" : "#5b8def") : t.textMuted;
  return (
    <Link href={href} style={{
      display:"flex", alignItems:"center", gap:"12px", width:"100%",
      padding:"11px 14px", borderRadius:"10px", border:"none", cursor:"pointer",
      textAlign:"left", textDecoration:"none",
      background: active ? (dark?"#1f2129":"#eaecf2") : "transparent",
      color,
      fontSize:"16px", fontWeight: active ? 700 : 500,
      marginBottom:"3px", transition:"all 0.15s",
    }}>
      {Icon && <Icon size={18} strokeWidth={active ? 2.5 : 2} />}
      <span style={{ flex:1 }}>{label}</span>
      {(badge ?? 0) > 0 && (
        <span style={{ background:"#d95565", color:"#fff", fontSize:"12px", fontWeight:800, padding:"2px 7px", borderRadius:"12px", fontFamily:"'JetBrains Mono',monospace" }}>
          {badge}
        </span>
      )}
    </Link>
  );
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { dark, setDark, servers, fetchServers, sessionExpired, setSessionExpired } = useAppStore();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [userName, setUserName]   = useState("Utilisateur");
  const [userRole, setUserRole]   = useState("Admin");
  const [userInit, setUserInit]   = useState("U");

  // ── WebSocket temps réel : refresh auto quand le sync pousse des données ──
  const handleWsMessage = useCallback((data: any) => {
    if (data.type === "sync_complete" && !_pauseAutoRefresh) {
      console.log(`[WS] 🔄 Sync reçu (${data.successCount}/${data.totalCount}) — Rafraîchissement...`);
      fetchServers();
    }
  }, [fetchServers]);
  useWebSocket(handleWsMessage);

  // Sync html.dark class with store
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    // Sync le store Zustand avec la classe html.dark posée par le script inline
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark !== dark) setDark(isDark);
    setMounted(true);
    apiFetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(data => {
      if (data) {
        const name = `${data.firstname||""} ${data.lastname||""}`.trim() || data.email?.split("@")[0] || "Utilisateur";
        setUserName(name);
        setUserRole(data.profileLabel || "Admin");
        setUserInit((data.firstname?.[0]||data.email?.[0]||"U").toUpperCase() + (data.lastname?.[0]||data.email?.[1]||"").toUpperCase());
      }
    }).catch(() => {});

    // Fetch initial
    fetchServers();

    // Trigger auto-sync once on login (first mount of session)
    apiFetch("/api/admin/servers/sync", { method: "POST" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) fetchServers(); // Re-fetch after sync
      })
      .catch(() => {});

    // Sync automatique toutes les 10s (le WS push gère l'update instant)
    const timer = setInterval(async () => {
      if (_pauseAutoRefresh) return;
      try {
        await apiFetch("/api/admin/servers/sync", { method: "POST" });
      } catch (e) {}
    }, 10000);

    return () => clearInterval(timer);
  }, [fetchServers]);

  // Stats dérivées des serveurs
  const alertCount = useMemo(() => {
    return servers.filter(s => {
      const isDiskAlert = (s.metrics?.diskUsedPct ?? 0) >= DISK_ALERT_PCT;
      const isOffline   = !s.agentActive || s.metrics?.status === "offline";
      return isDiskAlert || isOffline;
    }).length;
  }, [servers]);
  const providerStats = useMemo(() =>
    PROVIDERS.map(p => ({
      provider: p,
      total: servers.filter(s => s.provider === p).length,
      online: servers.filter(s => s.provider === p && s.agentActive).length,
      alert: servers.filter(s => s.provider === p && (s.metrics?.diskUsedPct ?? 0) >= DISK_ALERT_PCT).length,
    })), [servers]);

  const t = useTokens(dark);

  const NAV = [
    { href:"/dashboard", label:"Dashboard"  },
    { href:"/servers",   label:"Serveurs"   },
    { href:"/alerts",    label:"Alertes",   badge: alertCount },
    { href:"/logs",      label:"Logs"       },
    { href:"/admin",     label:"Admin"       },
  ];

  // Avant le mount : coque CSS-only qui réagit à html.dark → pas de flash, pas de hydration mismatch
  if (!mounted) {
    return (
      <div className="premount-shell">
        <aside className="premount-sidebar" />
        <div className="premount-main">{children}</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:t.bg, color:t.text, fontFamily:"'Inter',sans-serif" }}>
      {/* ── SIDEBAR ── */}
      <aside style={{
        position:"fixed", left:0, top:0, bottom:0, width:"256px",
        background:t.sidebar, borderRight:`1px solid ${t.border}`,
        display:"flex", flexDirection:"column", zIndex:100, overflowY:"auto",
      }}>
        {/* Logo */}
        <div style={{ padding:"24px 20px 32px" }}>
          <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
            <NebulOpsLogo size={40} />
            <div>
              <div style={{ fontSize:"24px", fontWeight:900, color:t.text, letterSpacing:"-0.03em" }}>NebulOps</div>
              <div style={{ fontSize:"11px", color:t.textFaint, letterSpacing:"0.1em", textTransform:"uppercase", fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>infra monitor</div>
            </div>
          </div>
        </div>

        {/* Nav principale */}
        <nav style={{ padding:"0 12px 24px" }}>
          {NAV.map(item => <NavItem key={item.href} {...item} pathname={pathname} dark={dark} t={t} />)}
        </nav>

        {/* Bottom Section */}
        <div style={{ marginTop:"auto" }}>
          {/* ── SECTION HÉBERGEURS ── */}
          <div style={{ padding:"20px 20px", borderTop:`1px solid ${t.border}` }}>
            <div style={{ fontSize:"12px", color:t.textFaint, fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:"16px" }}>Hébergeurs</div>
            {providerStats.map(({ provider, total }) => (
              <div key={provider} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"12px" }}>
                <div style={{ fontSize:"16px", fontWeight:700, color:PROVIDER_COLORS[provider] }}>{provider}</div>
                <div style={{ fontSize:"14px", color:t.textFaint, fontFamily:"'JetBrains Mono',monospace" }}>{total} srv</div>
              </div>
            ))}
          </div>

          {/* User Info */}
          <div style={{ padding:"24px 16px", borderTop:`1px solid ${t.border}` }}>
            <Link href="/profile" style={{ display:"flex", alignItems:"center", gap:"12px", textDecoration:"none" }}>
              {/* Avatar Circle */}
              <div style={{
                width:"44px", height:"44px", borderRadius:"50%", background:"#5b8def",
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"14px", fontWeight:800, color:"#fff", cursor:"pointer", flexShrink:0
              }}>
                {userInit}
              </div>
              <div style={{ flex:1, overflow:"hidden" }}>
                <div style={{
                  fontSize:"16px", fontWeight:700, color:t.text, whiteSpace:"nowrap",
                  overflow:"hidden", textOverflow:"ellipsis", marginBottom:"2px"
                }}>{userName}</div>
                <div style={{
                  display:"inline-block", padding:"1px 8px", borderRadius:"20px",
                  background:"#d9556520", color:"#d95565", fontSize:"12px", fontWeight:800
                }}>{userRole}</div>
              </div>
            </Link>
          </div>

          {/* Logout Button */}
          <div style={{ padding:"0 16px 24px" }}>
            <button onClick={() => setShowLogout(true)} style={{
              width:"100%", padding:"11px", borderRadius:"10px", border:`1px solid ${t.border}`,
              background:t.surfaceAlt, color:t.textMuted, fontSize:"14px", fontWeight:700,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:"8px",
              transition:"all 0.15s"
            }}>
              <LogOut size={16} strokeWidth={2.5} /> Se déconnecter
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <div style={{ marginLeft:"256px", minHeight:"100vh" }}>
        {/* Topbar */}
        <header style={{
          position:"sticky", top:0, zIndex:50,
          background:t.topbar, backdropFilter:"blur(12px)",
          padding:"24px 32px", display:"flex", alignItems:"center", justifyContent:"space-between",
        }}>
          <div style={{ fontSize:"16px", fontWeight:800, color:t.text, letterSpacing:"0.05em", textTransform:"uppercase" }}>
            {pathname.includes("dashboard") && <span>Vue d'ensemble</span>}
            {pathname.includes("servers") && <span>Gestion des serveurs</span>}
            {pathname.includes("alerts") && <span>Alertes actives</span>}
            {pathname.includes("logs") && <span>Logs critiques</span>}
            {pathname.includes("admin") && <span>Administration</span>}
          </div>

          <div style={{ display:"flex", gap:"16px", alignItems:"center" }}>
            {/* Theme Toggle Button */}
            <button
              onClick={() => setDark(!dark)}
              style={{
                width:"40px", height:"40px", borderRadius:"10px", border:`1px solid ${t.border}`,
                background:t.surfaceAlt, color:dark?"#d4a843":"#64748b", cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:"20px"
              }}>
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Online Stats */}
            <div style={{ display:"flex", alignItems:"center", gap:"12px", padding:"9px 18px", borderRadius:"12px", background:t.surfaceAlt, border:`1px solid ${t.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:"#4dab8a" }} />
                <span style={{ fontSize:"14px", color:t.textMuted, fontWeight:600 }}>{servers.filter(s=>s.agentActive).length} online</span>
              </div>
            </div>
          </div>
        </header>

        <div style={{ padding:"32px 32px 64px" }}>{children}</div>
      </div>

      {/* Modal déconnexion */}
      {showLogout && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, backdropFilter:"blur(4px)" }} onClick={() => setShowLogout(false)}>
          <div onClick={e=>e.stopPropagation()} style={{ background:t.surface, border:`1px solid ${t.borderMid}`, borderRadius:"16px", padding:"36px", width:"420px", textAlign:"center" }}>
            <div style={{ marginBottom:"16px", display:"flex", justifyContent:"center" }}><LogOut size={36} color="#d95565" /></div>
            <div style={{ fontSize:"20px", fontWeight:800, color:t.text, marginBottom:"10px" }}>Déconnexion</div>
            <div style={{ fontSize:"14px", color:t.textMuted, marginBottom:"28px", lineHeight:1.6 }}>Êtes-vous sûr de vouloir vous déconnecter de votre session ?</div>
            <div style={{ display:"flex", gap:"12px" }}>
              <button onClick={async()=>{ await fetch("/api/auth/logout",{method:"POST"}); window.location.href="/"; }}
                style={{ flex:1, padding:"12px", borderRadius:"10px", border:"none", background:"#d95565", color:"#fff", fontSize:"14px", fontWeight:700, cursor:"pointer" }}>
                Oui, se déconnecter
              </button>
              <button onClick={()=>setShowLogout(false)}
                style={{ flex:1, padding:"12px", borderRadius:"10px", border:`1px solid ${t.border}`, background:"none", color:t.textMuted, fontSize:"14px", fontWeight:700, cursor:"pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
      <div id="toast-root"><Toast /></div>
      
      {/* ── Global Session Expired Modal ── */}
      <SessionExpiredModal 
        isOpen={sessionExpired} 
        onClose={() => setSessionExpired(false)} 
      />
    </div>
  );
}
