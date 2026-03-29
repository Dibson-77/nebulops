"use client";

import React from "react";
import { Provider, Environment, Role, MetricStatus } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & PALETTE
// ─────────────────────────────────────────────────────────────────────────────

export const PROVIDER_COLORS: Record<Provider, string> = {
  OVH:   "#5b8def",
  Azure: "#4ba3d9",
  AWS:   "#e08a4a",
};

export const ENV_COLORS: Record<Environment, string> = {
  Dev:    "#5bb8cf",
  Demo:   "#9585d3",
  Pilote: "#d4a843",
  Prod:   "#4dab8a",
  Backup: "#8891a0",
};

export const ROLE_COLORS: Record<Role, string> = {
  admin:    "#d95565",
  operator: "#d4a843",
  viewer:   "#7b84c9",
};

export const STATUS_COLORS: Record<MetricStatus, string> = {
  online:   "#4dab8a",
  offline:  "#d95565",
  degraded: "#d4a843",
  unknown:  "#8891a0",
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

export function ProviderBadge({ provider }: { provider: Provider }) {
  return (
    <span style={{ fontSize:"14px", fontWeight:800, letterSpacing:"0.05em", padding:"4px 12px", borderRadius:"8px", fontFamily:"'JetBrains Mono',monospace", background:PROVIDER_COLORS[provider]+"22", color:PROVIDER_COLORS[provider], border:`1px solid ${PROVIDER_COLORS[provider]}44` }}>
      {provider}
    </span>
  );
}

export function EnvPill({ env }: { env: Environment }) {
  return (
    <span style={{ fontSize:"13px", fontWeight:800, letterSpacing:"0.08em", textTransform:"uppercase", padding:"4px 12px", borderRadius:"20px", background:ENV_COLORS[env]+"18", color:ENV_COLORS[env], border:`1px solid ${ENV_COLORS[env]}33` }}>
      {env}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const labels: Record<Role,string> = { admin:"Admin", operator:"Opérateur", viewer:"Observateur" };
  return (
    <span style={{ fontSize:"14px", fontWeight:800, padding:"4px 12px", borderRadius:"20px", background:ROLE_COLORS[role]+"18", color:ROLE_COLORS[role], border:`1px solid ${ROLE_COLORS[role]}33` }}>
      {labels[role]}
    </span>
  );
}

export function StatusDot({ status }: { status: MetricStatus }) {
  const pulse = status === "online";
  return (
    <span title={status} style={{ display:"inline-block", width:"10px", height:"10px", borderRadius:"50%", background:STATUS_COLORS[status], boxShadow: pulse ? `0 0 0 3px ${STATUS_COLORS[status]}30` : "none", flexShrink:0 }} />
  );
}

export function Avatar({ initials, size = 32 }: { initials: string; size?: number }) {
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:"linear-gradient(135deg,#5b8def,#6b70bf)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.35, fontWeight:700, color:"#fff", flexShrink:0 }}>
      {initials}
    </div>
  );
}
