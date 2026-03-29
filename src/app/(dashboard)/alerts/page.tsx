"use client";

/**
 * app/(dashboard)/alerts/page.tsx
 * ───────────────────────────────
 * Vue dédiée aux alertes critiques (disque plein, etc.).
 */

import { useState } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useTokens } from "@/hooks/use-tokens";
import { StatusDot, ProviderBadge, EnvPill } from "@/components/dashboard/StatusAtoms";
import { DiskAlertBars } from "@/components/dashboard/Charts";
import { ServerDetailModal } from "@/components/dashboard/Modals";
import { Server } from "@/types";
import { formatGb } from "@/lib/helpers";
import { AlertTriangle, WifiOff } from "lucide-react";

const DISK_ALERT_PCT = 80;

export default function AlertsPage() {
  const { dark, servers } = useAppStore();
  const t = useTokens(dark);

  const [selected, setSelected] = useState<Server | null>(null);

  const alerts = servers.filter(s => {
    const isDiskAlert = (s.metrics?.diskUsedPct ?? 0) >= DISK_ALERT_PCT;
    const isOffline   = !s.agentActive || s.metrics?.status === "offline";
    return isDiskAlert || isOffline;
  });

  return (
    <>
      <div style={{ fontSize:"14px", color:t.textMuted, marginBottom:"20px" }}>
        Liste des incidents critiques nécessitant une attention immédiate.
      </div>
      
      {alerts.length === 0 ? (
        <div style={{ background:t.surface, border:"1px solid #4dab8a33", borderRadius:"12px", padding:"48px", textAlign:"center", marginBottom:"32px" }}>
          <div style={{ fontSize:"42px", marginBottom:"12px" }}>✓</div>
          <div style={{ fontSize:"16px", fontWeight:800, color:"#4dab8a" }}>Aucune alerte active</div>
          <div style={{ fontSize:"14px", color:t.textMuted, marginTop:"6px" }}>Tous les serveurs sont opérationnels.</div>
        </div>
      ) : (
        <div style={{ display:"grid", gap:"12px", marginBottom:"28px" }}>
          {alerts.map(s => {
            const isOffline = !s.agentActive || s.metrics?.status === "offline";
            const isDisk = (s.metrics?.diskUsedPct ?? 0) >= DISK_ALERT_PCT;

            return (
              <div key={s.id} onClick={() => setSelected(s)}
                style={{ background:t.surface, border:`1px solid ${isOffline ? "#8891a033" : "#d9556533"}`, borderRadius:"12px", padding:"22px 28px", cursor:"pointer", display:"flex", alignItems:"center", gap:"24px", transition:"border-color 0.2s" }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = isOffline ? "#8891a088" : "#d9556588"}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = isOffline ? "#8891a033" : "#d9556533"}>
                
                <div style={{ width:"48px", height:"48px", borderRadius:"12px", background: isOffline ? "#8891a015" : "#d9556515", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {isOffline ? <WifiOff size={22} color="#8891a0" /> : <AlertTriangle size={22} color="#d95565" />}
                </div>

                <div style={{ flex:1 }}>
                  <div style={{ display:"flex", gap:"10px", alignItems:"center", marginBottom:"8px", flexWrap:"wrap" }}>
                    <span style={{ fontSize:"16px", fontWeight:800, color:t.text }}>{s.name}</span>
                    <ProviderBadge provider={s.provider} />
                    <EnvPill env={s.environment} />
                  </div>
                  <div style={{ fontSize:"13px", color: isOffline ? "#d95565" : t.textMuted, fontWeight: isOffline ? 700 : 400, fontFamily:"'JetBrains Mono',monospace" }}>
                    {isOffline ? "AGENT DÉCONNECTÉ" : s.ip}
                  </div>
                </div>

                <div style={{ textAlign:"right" }}>
                  {isDisk ? (
                    <>
                      <div style={{ fontSize:"36px", fontWeight:800, color:"#d95565", fontFamily:"'JetBrains Mono',monospace", lineHeight:1 }}>{s.metrics!.diskUsedPct}%</div>
                      <div style={{ fontSize:"12px", color:t.textFaint, marginTop:"4px" }}>Disque ({formatGb(s.metrics!.diskFreeGb)} libres)</div>
                    </>
                  ) : (
                    <div style={{ fontSize:"14px", fontWeight:800, color:"#d95565", textTransform:"uppercase", letterSpacing:"0.05em" }}>
                      Hors-ligne
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DiskAlertBars servers={servers} dark={dark} />

      {selected && <ServerDetailModal server={selected} onClose={() => setSelected(null)} dark={dark} />}
    </>
  );
}
