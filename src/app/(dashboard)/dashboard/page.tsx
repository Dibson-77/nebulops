"use client";

/**
 * app/(dashboard)/dashboard/page.tsx
 * ────────────────────────
 * Vue Dashboard : KPIs globaux et graphiques de synthèse.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/store/use-app-store";
import { useTokens } from "@/hooks/use-tokens";
import { ProviderDonut, DiskUsedVsFreeChart, DiskHeatmap } from "@/components/dashboard/Charts";
import { Kpi } from "@/components/dashboard/KPI";
import DashboardLoading from "../loading";
import { X, Box, Server as ServerIcon } from "lucide-react";

export default function DashboardPage() {
  const { dark, servers, isInitialLoading } = useAppStore();
  const [showStopped, setShowStopped] = useState(false);
  const router = useRouter();
  const t = useTokens(dark);

  const onlineCount   = servers.filter(s => s.agentActive).length;
  const alertCount    = servers.filter(s => !s.agentActive || (s.metrics?.diskUsedPct ?? 0) >= 80).length;

  // Build list of stopped containers with their parent server info
  const stoppedList = useMemo(() => {
    const items: { serverId: number; serverName: string; serverIp: string; containerName: string; image: string; status: string }[] = [];
    for (const s of servers) {
      if (!s.agentActive) continue;
      const containers = Array.isArray((s as any).containers) ? (s as any).containers : [];
      for (const c of containers) {
        if (typeof c.status === "string" && /^Exited\b/i.test(c.status)) {
          items.push({ serverId: s.id, serverName: s.name, serverIp: s.ip, containerName: c.name, image: c.image, status: c.status });
        }
      }
    }
    return items;
  }, [servers]);

  const totalDiskTb   = (servers.reduce((a, s) => a + (s.metrics?.diskTotalGb ?? 0), 0) / 1024).toFixed(1);
  const activeServersWithDisk = servers.filter(s => s.agentActive && s.metrics?.diskUsedPct !== undefined);
  const avgUsage      = activeServersWithDisk.length > 0
    ? Math.round(activeServersWithDisk.reduce((a, s) => a + (s.metrics!.diskUsedPct), 0) / activeServersWithDisk.length)
    : 0;

  return (
    <div key={isInitialLoading ? "loading" : "ready"}>
      {isInitialLoading ? (
        <DashboardLoading />
      ) : (
        <>
          {/* KPIs */}
          <div style={{ display:"flex", gap:"12px", marginBottom:"24px", flexWrap:"wrap" }}>
            <Kpi dark={dark} label="Serveurs"         value={`${servers.length}`}   sub={`${onlineCount} en ligne`} />
            <Kpi dark={dark} label="Alertes"          value={`${alertCount}`}    sub="hors ligne ou disque > 80%" accent={alertCount > 0 ? "#d95565" : undefined} />
            <Kpi dark={dark} label="Capacité totale"  value={`${totalDiskTb} To`}   sub="tous hébergeurs" />
            <Kpi dark={dark} label="Utilisation moy." value={`${avgUsage}%`}        sub="disque moyen" />
            <Kpi dark={dark} label="Services arrêtés"  value={`${stoppedList.length}`} sub="conteneurs Docker stoppés" accent={stoppedList.length > 0 ? "#d4a843" : undefined} onClick={() => stoppedList.length > 0 && setShowStopped(true)} />
          </div>

          {/* Modal liste des services arrêtés */}
          {showStopped && (
            <>
              <div onClick={() => setShowStopped(false)} style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:200, backdropFilter:"blur(2px)" }} />
              <div style={{
                position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", zIndex:300,
                width:560, maxWidth:"92vw", maxHeight:"75vh", display:"flex", flexDirection:"column",
                background: dark ? "#16181e" : "#ffffff", borderRadius:16,
                border:`1px solid ${t.borderMid}`, boxShadow:"0 20px 60px rgba(0,0,0,0.35)",
                animation:"fadeIn 0.18s ease",
              }}>
                <style>{`@keyframes fadeIn { from { opacity:0; transform:translate(-50%,-50%) scale(0.96); } to { opacity:1; transform:translate(-50%,-50%) scale(1); } }`}</style>

                {/* Header */}
                <div style={{ padding:"20px 24px 16px", borderBottom:`1px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background:"#d4a84318", border:"1px solid #d4a84333", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <Box size={18} color="#d4a843" />
                    </div>
                    <div>
                      <div style={{ fontSize:15, fontWeight:800, color:t.text }}>Services arrêtés</div>
                      <div style={{ fontSize:11, color:t.textMuted }}>{stoppedList.length} conteneur{stoppedList.length > 1 ? "s" : ""} Docker stoppé{stoppedList.length > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                  <button onClick={() => setShowStopped(false)} style={{ width:32, height:32, borderRadius:8, border:`1px solid ${t.border}`, background:t.surfaceAlt, color:t.textMuted, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                    <X size={16} />
                  </button>
                </div>

                {/* List */}
                <div style={{ padding:"12px 16px", overflowY:"auto", flex:1 }}>
                  {stoppedList.map((item, i) => (
                    <div
                      key={`${item.serverId}-${item.containerName}-${i}`}
                      onClick={() => { setShowStopped(false); router.push(`/servers?serverId=${item.serverId}`); }}
                      style={{
                        display:"flex", alignItems:"center", gap:14, padding:"12px 14px", borderRadius:10, cursor:"pointer",
                        border:`1px solid ${t.border}`, background:t.surface, marginBottom:8,
                        transition:"all 0.15s ease",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = "#d4a843"; e.currentTarget.style.background = dark ? "#1a2a3f" : "#fffbeb"; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.background = t.surface; }}
                    >
                      {/* Stopped indicator */}
                      <div style={{ width:10, height:10, borderRadius:"50%", background:"#d95565", flexShrink:0 }} />

                      {/* Container info */}
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:t.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {item.containerName}
                        </div>
                        <div style={{ fontSize:11, color:t.textMuted, fontFamily:"'JetBrains Mono',monospace" }}>
                          {item.image} — <span style={{ color:"#d95565" }}>{item.status}</span>
                        </div>
                      </div>

                      {/* Server link */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:6, background:t.surfaceAlt, border:`1px solid ${t.border}`, flexShrink:0 }}>
                        <ServerIcon size={12} color={t.textMuted} />
                        <div style={{ fontSize:11, fontWeight:600, color:t.textMuted, whiteSpace:"nowrap" }}>{item.serverName}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Charts row 1 */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px", marginBottom:"16px" }}>
            <ProviderDonut servers={servers} dark={dark} />
            <DiskUsedVsFreeChart servers={servers} dark={dark} />
          </div>

          {/* Chart row 2 — full width */}
          <DiskHeatmap servers={servers} dark={dark} />
        </>
      )}
    </div>
  );
}
