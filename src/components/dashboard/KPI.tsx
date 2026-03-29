"use client";

import React from "react";
import { useTokens } from "@/hooks/use-tokens";

interface KpiProps {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  dark: boolean;
  onClick?: () => void;
}

export function Kpi({ label, value, sub, accent, dark, onClick }: KpiProps) {
  const t = useTokens(dark);
  return (
    <div
      onClick={onClick}
      style={{
        background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, borderRadius:"12px", padding:"24px 28px", flex:1, minWidth:"180px",
        ...(onClick ? { cursor:"pointer", transition:"all 0.15s ease" } : {}),
      }}
      onMouseEnter={onClick ? (e => { e.currentTarget.style.borderColor = accent || "#5b8def"; e.currentTarget.style.transform = "translateY(-1px)"; }) : undefined}
      onMouseLeave={onClick ? (e => { e.currentTarget.style.borderColor = t.borderMid; e.currentTarget.style.transform = "translateY(0)"; }) : undefined}
    >
      <div style={{ fontSize:"14px", color:t.textFaint, fontWeight:800, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:"14px" }}>{label}</div>
      <div style={{ fontSize:"32px", fontWeight:800, color:accent ?? t.text, fontFamily:"'JetBrains Mono',monospace", letterSpacing:"-0.03em", lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:"14px", color:t.textMuted, marginTop:"10px", fontWeight:600 }}>{sub}</div>}
    </div>
  );
}
