"use client";

/**
 * components/dashboard/Charts.tsx
 */
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ReferenceLine
} from "recharts";
import { useTokens } from "@/hooks/use-tokens";
import { formatGb, diskColor } from "@/lib/helpers";
import type { Server, Provider } from "@/types";
import { StatusDot, EnvPill, ProviderBadge, PROVIDER_COLORS } from "@/components/dashboard/StatusAtoms";

export function ChartTooltip({ active, payload, label, dark }: any) {
  const t = useTokens(dark);
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:t.surface, border:`1px solid ${t.borderMid}`, borderRadius:"10px", padding:"12px 18px", fontSize:"14px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)" }}>
      {label && <div style={{ color:t.textMuted, marginBottom:"8px", fontWeight:700 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"5px" }}>
          <div style={{ width:"10px", height:"10px", borderRadius:"3px", background:p.color, flexShrink:0 }} />
          <span style={{ color:t.textMuted }}>{p.name}:</span>
          <span style={{ color:t.text, fontWeight:800, fontFamily:"'JetBrains Mono',monospace" }}>
            {p.name === "Taux" ? `${p.value}%` : formatGb(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProviderDonut({ servers, dark }: { servers: Server[]; dark: boolean }) {
  const t = useTokens(dark);
  const data = (["OVH","Azure","AWS"] as Provider[]).map(p => ({
    name: p,
    value: servers.filter(s => s.provider === p).reduce((a, s) => a + (s.metrics?.diskTotalGb ?? 0), 0),
    color: PROVIDER_COLORS[p],
  })).filter(d => d.value > 0);

  const total = data.reduce((a, d) => a + d.value, 0);

  return (
    <div style={{ background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, borderRadius:"12px", padding:"28px 32px" }}>
      <div style={{ fontSize:"15px", fontWeight:800, color:t.text, marginBottom:"8px" }}>Capacité totale par hébergeur</div>
      <div style={{ fontSize:"13px", color:t.textMuted, marginBottom:"24px" }}>Espace disque total · Go</div>
      <div style={{ display:"flex", alignItems:"center", gap:"20px" }}>
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie data={data} cx={75} cy={75} innerRadius={50} outerRadius={72} dataKey="value" paddingAngle={3}>
              {data.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
            </Pie>
            <Tooltip content={<ChartTooltip dark={dark} />} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex:1 }}>
          {data.map(d => (
            <div key={d.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <div style={{ width:"12px", height:"12px", borderRadius:"3px", background:d.color }} />
                <span style={{ fontSize:"14px", color:t.textMuted }}>{d.name}</span>
              </div>
              <div style={{ textAlign:"right" }}>
                <div style={{ fontSize:"14px", fontWeight:800, color:t.text, fontFamily:"'JetBrains Mono',monospace" }}>{formatGb(d.value)}</div>
                <div style={{ fontSize:"12px", color:t.textFaint }}>{total ? Math.round(d.value/total*100) : 0}%</div>
              </div>
            </div>
          ))}
          <div style={{ borderTop:`1px solid ${t.border}`, paddingTop:"12px", display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:"13px", color:t.textFaint }}>Total</span>
            <span style={{ fontSize:"14px", fontWeight:800, color:t.text, fontFamily:"'JetBrains Mono',monospace" }}>{formatGb(total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiskUsedVsFreeChart({ servers, dark }: { servers: Server[]; dark: boolean }) {
  const t = useTokens(dark);
  const active = servers.filter(s => s.agentActive && s.metrics && s.metrics.diskTotalGb > 0);

  const data = active.map(s => ({
    name: s.ip.split(".").slice(-2).join("."),
    fullName: s.name,
    Utilisé: s.metrics!.diskUsedGb,
    Libre: s.metrics!.diskFreeGb,
    pct: s.metrics!.diskUsedPct,
  }));

  return (
    <div style={{ background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, borderRadius:"12px", padding:"24px 28px" }}>
      <div style={{ fontSize:"14px", fontWeight:800, color:t.text, marginBottom:"6px" }}>Disque utilisé vs libre par serveur</div>
      <div style={{ fontSize:"13px", color:t.textMuted, marginBottom:"20px" }}>Go · {active.length} serveurs avec agent actif</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top:0, right:0, left:-10, bottom:0 }} barSize={14}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize:12, fill:t.chartText }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize:12, fill:t.chartText }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v/1024).toFixed(1)}T` : `${v}G`} />
          <Tooltip content={<ChartTooltip dark={dark} />} cursor={{ fill: t.diskBg + "66" }} />
          <Legend wrapperStyle={{ fontSize:"13px", color:t.textMuted }} />
          <Bar dataKey="Utilisé" stackId="a" fill="#5b8def" radius={[0,0,3,3]} />
          <Bar dataKey="Libre"   stackId="a" fill={t.diskBg} radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DiskHeatmap({ servers, dark }: { servers: Server[]; dark: boolean }) {
  const t = useTokens(dark);
  
  // Ordre des environnements (exclu Backup s'il n'est pas dans le mockup, mais on peut le mettre)
  const envsOrder = ["Dev", "Demo", "Pilote", "Prod"];
  
  const data: any[] = [];
  envsOrder.forEach((envKey, eIdx) => {
    const envServers = servers.filter(s => 
      s.environment === envKey && s.metrics
    );
    
    envServers.forEach((s, sIdx) => {
      // Pour l'affichage de l'étiquette au milieu du groupe
      const mid = Math.floor(envServers.length / 2);
      const displayLabel = sIdx === mid ? (envKey === "Demo" ? "Démo" : envKey) : "";
      
      data.push({
        id: s.id,
        fullName: s.name,
        ip: s.ip,
        Taux: s.metrics!.diskUsedPct,
        envLabel: displayLabel,
        color: !s.agentActive ? "#8891a0" : (s.metrics!.diskUsedPct >= 80 ? "#d95565" : (PROVIDER_COLORS[s.provider] || "#5b8def"))
      });
    });

    // Petit espacement entre groupes
    if (eIdx < envsOrder.length - 1 && envServers.length > 0) {
      data.push({ id: `gap-${eIdx}`, gap: true, Taux: 0, envLabel: "" });
    }
  });

  return (
    <div style={{ background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, borderRadius:"12px", padding:"24px 28px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
        <div>
          <div style={{ fontSize:"14px", fontWeight:800, color:t.text, display:"flex", alignItems:"center", gap:"8px" }}>
            🔥 Carte de chaleur — Taux de remplissage par environnement
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top:20, right:30, left:0, bottom:0 }} barSize={34}>
          <CartesianGrid strokeDasharray="3 3" stroke={t.chartGrid} vertical={false} />
          <XAxis 
            dataKey="envLabel" 
            tick={{ fontSize:12, fill:t.textMuted, fontWeight:700 }} 
            axisLine={false} 
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize:11, fill:t.chartText }} 
            axisLine={false} 
            tickLine={false} 
            domain={[0, 100]}
            tickFormatter={v => `${v}%`}
          />
          <Tooltip 
            content={<ChartTooltip dark={dark} />} 
            cursor={{ fill: t.diskBg + "33" }} 
            // labelFormatter de base ne sert pas si on utilise ChartTooltip
          />
          
          <ReferenceLine y={80} stroke="#d95565" strokeDasharray="3 3" strokeWidth={1}>
            <text x="100%" y={75} textAnchor="end" fill="#d95565" fontSize="11" fontWeight={700}>
              ▲ Seuil alerte 80%
            </text>
          </ReferenceLine>

          <Bar dataKey="Taux" radius={[3, 3, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Légende personnalisée en bas (match mockup) */}
      <div style={{ marginTop:"20px", display:"flex", gap:"24px", borderTop:`1px solid ${t.border}`, paddingTop:"16px", flexWrap:"wrap" }}>
        <div style={{ fontSize:"13px", fontWeight:900, color:t.text }}>Légende :</div>
        <div style={{ display:"flex", gap:"16px", alignItems:"center" }}>
          {(["OVH", "Azure", "AWS"] as Provider[]).map(p => (
            <div key={p} style={{ display:"flex", alignItems:"center", gap:"8px" }}>
              <div style={{ width:"16px", height:"16px", borderRadius:"3px", background:PROVIDER_COLORS[p], border:`1px solid ${t.borderMid}` }} />
              <span style={{ fontSize:"12px", color:t.textMuted }}>Serveur {p}</span>
            </div>
          ))}
          <div style={{ display:"flex", alignItems:"center", gap:"8px", color:"#d95565" }}>
            <span style={{ fontSize:"12px", fontWeight:700 }}>▲ Rouge = disque &gt; 80 % utilisé</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function DiskAlertBars({ servers, dark }: { servers: Server[]; dark: boolean }) {
  const t = useTokens(dark);
  const active = servers.filter(s => s.metrics && s.metrics.diskTotalGb > 0)
    .sort((a, b) => (b.metrics!.diskUsedPct) - (a.metrics!.diskUsedPct));

  return (
    <div style={{ background:t.surfaceAlt, border:`1px solid ${t.borderMid}`, borderRadius:"12px", padding:"24px 28px" }}>
      <div style={{ fontSize:"14px", fontWeight:800, color:t.text, marginBottom:"6px" }}>Utilisation disque — vue globale</div>
      <div style={{ fontSize:"13px", color:t.textMuted, marginBottom:"20px" }}>Trié par taux le plus élevé</div>
      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        {active.map(s => (
          <div key={s.id} style={{ display:"flex", alignItems:"center", gap:"14px" }}>
            <div style={{ width:"150px", flexShrink:0 }}>
              <div style={{ fontSize:"13px", fontWeight:800, color:t.text, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.name}</div>
              <div style={{ fontSize:"11px", color:t.textFaint, fontFamily:"'JetBrains Mono',monospace", fontWeight:700 }}>{s.ip}</div>
            </div>
            <div style={{ flex:1, height:"8px", background:t.diskBg, borderRadius:"4px", overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${s.metrics!.diskUsedPct}%`, background:diskColor(s.metrics!.diskUsedPct), borderRadius:"4px", transition:"width 0.6s ease" }} />
            </div>
            <div style={{ width:"45px", textAlign:"right", fontSize:"13px", fontWeight:800, color:diskColor(s.metrics!.diskUsedPct), fontFamily:"'JetBrains Mono',monospace", flexShrink:0 }}>
              {s.metrics!.diskUsedPct}%
            </div>
            <div style={{ width:"50px", flexShrink:0 }}><ProviderBadge provider={s.provider} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}
