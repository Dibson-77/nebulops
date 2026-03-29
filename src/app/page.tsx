"use client";

/**
 * src/app/page.tsx — NebulOps Login Page
 * ─────────────────────────────────────────
 * Split-screen asymétrique :
 *   Gauche  — dark, réseau animé + stats infra + ticker métriques live simulées
 *   Droite  — formulaire credentials → OTP 6 cases
 * Boot animation après validation OTP
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Mail, Lock, ShieldCheck, ArrowLeft,
  Loader2, AlertCircle, CheckCircle2,
  Server, Activity, HardDrive, Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Node { x:number; y:number; vx:number; vy:number; r:number; pulse:number; }

// ─── Canvas : réseau de nœuds flottants ────────────────────────────────────────

function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef   = useRef<number>(0);
  const nodes     = useRef<Node[]>([]);
  const mounted   = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    nodes.current = Array.from({ length: 32 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.42,
      vy: (Math.random() - 0.5) * 0.42,
      r: Math.random() * 2.8 + 1.6,
      pulse: Math.random() * Math.PI * 2,
    }));

    const draw = () => {
      if (!mounted.current) return;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      nodes.current.forEach(n => {
        n.x += n.vx; n.y += n.vy; n.pulse += 0.022;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      });

      // Arêtes
      for (let i = 0; i < nodes.current.length; i++) {
        for (let j = i + 1; j < nodes.current.length; j++) {
          const dx = nodes.current[i].x - nodes.current[j].x;
          const dy = nodes.current[i].y - nodes.current[j].y;
          const d  = Math.hypot(dx, dy);
          if (d < 125) {
            ctx.beginPath();
            ctx.moveTo(nodes.current[i].x, nodes.current[i].y);
            ctx.lineTo(nodes.current[j].x, nodes.current[j].y);
            ctx.strokeStyle = `rgba(59,130,246,${(1 - d / 125) * 0.22})`;
            ctx.lineWidth   = 0.75;
            ctx.stroke();
          }
        }
      }

      // Nœuds
      nodes.current.forEach(n => {
        const g = Math.sin(n.pulse) * 0.5 + 0.5;
        const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
        // Halo plus blanc et intense
        gr.addColorStop(0, `rgba(255, 255, 255, ${0.18 * g})`);
        gr.addColorStop(1, "rgba(59, 130, 246, 0)");
        
        ctx.beginPath(); 
        ctx.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = gr; 
        ctx.fill();

        // Point central blanc pur et brillant
        ctx.beginPath(); 
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 + 0.15 * g})`; 
        ctx.fill();
      });

      animRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      mounted.current = false;
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ opacity: 0.72 }}
    />
  );
}

// ─── Données simulées (ticker) ──────────────────────────────────────────────────

const MOCK_SERVERS = [
  { name:"PROD SMC",        ip:"54.37.65.15",    cpu:78, disk:85, ram:88, status:"degraded" },
  { name:"DATA / STOCKAGE", ip:"51.91.77.193",   cpu:18, disk:73, ram:68, status:"online"   },
  { name:"EAV3",            ip:"107.20.28.186",  cpu:12, disk:61, ram:54, status:"online"   },
  { name:"CMEVPS OVH",      ip:"51.91.79.82",    cpu:67, disk:85, ram:81, status:"degraded" },
  { name:"MONITORING",      ip:"51.91.78.99",    cpu:14, disk:40, ram:48, status:"online"   },
  { name:"PROD DIVI POST",  ip:"54.158.11.28",   cpu:55, disk:65, ram:61, status:"online"   },
];

function statusColor(s: string) {
  return s === "online" ? "#4dab8a" : s === "degraded" ? "#d4a843" : "#d95565";
}

// ─── Ticker : un serveur défile toutes les 2.6s ──────────────────────────────

function MetricTicker() {
  const [idx, setIdx]         = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => {
      setVisible(false);
      setTimeout(() => { setIdx(i => (i + 1) % MOCK_SERVERS.length); setVisible(true); }, 280);
    }, 2600);
    return () => clearInterval(iv);
  }, []);

  const srv = MOCK_SERVERS[idx];

  return (
    <div
      style={{
        transition: "opacity 0.28s ease, transform 0.28s ease",
        opacity:    visible ? 1 : 0,
        transform:  visible ? "translateY(0)" : "translateY(8px)",
        padding:    "12px 14px",
        borderRadius: "12px",
        background: "rgba(59,130,246,0.05)",
        border:     "1px solid rgba(59,130,246,0.12)",
      }}
    >
      {/* Ligne nom + IP */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          <div
            style={{
              width:"8px", height:"8px", borderRadius:"50%", flexShrink:0,
              background: statusColor(srv.status),
              boxShadow:  `0 0 6px ${statusColor(srv.status)}`,
            }}
          />
          <span style={{ fontSize:"12px", fontWeight:800, color:"#c7d8f5", fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.02em" }}>{srv.name}</span>
        </div>
        <span style={{ fontSize:"10px", color:"#4a5c7a", fontFamily:"'JetBrains Mono',monospace" }}>{srv.ip}</span>
      </div>

      {/* Métriques */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:"8px" }}>
        {[
          { Icon:Cpu,       label:"CPU",  value:srv.cpu,  warn:srv.cpu  > 75 },
          { Icon:HardDrive, label:"DISK", value:srv.disk, warn:srv.disk >= 80 },
          { Icon:Activity,  label:"RAM",  value:srv.ram,  warn:srv.ram  > 85 },
        ].map(({ Icon, label, value, warn }) => (
          <div key={label}>
            <div style={{ display:"flex", alignItems:"center", gap:"5px", marginBottom:"4px" }}>
              <Icon style={{ width:11, height:11, color:"#4a5c7a" }} />
              <span style={{ fontSize:"10px", color:"#4a5c7a", fontWeight:600, letterSpacing:"0.06em" }}>{label}</span>
            </div>
            <div style={{ height:"3px", background:"rgba(255,255,255,0.06)", borderRadius:"2px", overflow:"hidden", marginBottom:"3px" }}>
              <div style={{
                height:"100%", width:`${value}%`, borderRadius:"2px",
                background: warn ? (value >= 85 ? "#d95565" : "#d4a843") : "#5b8def",
                transition: "width 0.6s ease",
              }} />
            </div>
            <span style={{ fontSize:"11px", fontWeight:800, fontFamily:"'JetBrains Mono',monospace", color: warn ? (value >= 85 ? "#d95565" : "#d4a843") : "#7cb3ff" }}>{value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Animation "System Boot" ─────────────────────────────────────────────────

const BOOT_LINES = [
  { delay:0,    text:"[ OK ] Authentification validée"           },
  { delay:300,  text:"[ OK ] Chargement des sessions..."         },
  { delay:580,  text:"[ OK ] Connexion agents distants..."       },
  { delay:870,  text:"[ OK ] Synchronisation métriques (12/12)"  },
  { delay:1120, text:"[ OK ] Tableau de bord prêt"               },
];

function SystemBootOverlay({ username }: { username: string }) {
  const [visible, setVisible] = useState<number[]>([]);
  const [pct, setPct]         = useState(0);

  useEffect(() => {
    BOOT_LINES.forEach((l, i) => setTimeout(() => setVisible(p => [...p, i]), l.delay));
    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min(100, Math.round(((Date.now() - start) / 1800) * 100));
      setPct(p);
      if (p >= 100) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"linear-gradient(135deg,#04091a 0%,#070f20 60%,#0a1428 100%)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", fontFamily:"'JetBrains Mono','Courier New',monospace" }}>
      {/* Logo */}
      <div style={{ marginBottom:"48px", textAlign:"center" }}>
        <div style={{ width:"72px", height:"72px", borderRadius:"20px", margin:"0 auto 20px", background:"linear-gradient(135deg,#5b8def,#2563eb)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"32px", boxShadow:"0 0 40px rgba(59,130,246,0.55), 0 0 80px rgba(59,130,246,0.2)", animation:"boot-glow 1.4s ease-in-out infinite" }}>⬡</div>
        <div style={{ fontSize:"22px", fontWeight:800, color:"#e2eaf5", letterSpacing:"-0.02em" }}>NebulOps</div>
        <div style={{ fontSize:"13px", color:"#5b8def", marginTop:"6px", fontWeight:600 }}>Bienvenue, {username}</div>
      </div>

      {/* Terminal */}
      <div style={{ width:"480px", maxWidth:"90vw", background:"rgba(13,27,46,0.85)", border:"1px solid rgba(59,130,246,0.2)", borderRadius:"14px", padding:"24px 28px", marginBottom:"32px" }}>
        {BOOT_LINES.map((l, i) => (
          <div key={i} style={{ fontSize:"12px", lineHeight:"2.1", color: visible.includes(i) ? "#4dab8a" : "transparent", transition:"color 0.3s, opacity 0.3s", opacity: visible.includes(i) ? 1 : 0 }}>
            {l.text}
          </div>
        ))}
      </div>

      {/* Barre */}
      <div style={{ width:"480px", maxWidth:"90vw" }}>
        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"8px" }}>
          <span style={{ fontSize:"11px", color:"#4a5c7a", fontWeight:600 }}>Initialisation du tableau de bord</span>
          <span style={{ fontSize:"11px", color:"#5b8def", fontWeight:800 }}>{pct}%</span>
        </div>
        <div style={{ height:"4px", background:"rgba(59,130,246,0.12)", borderRadius:"2px", overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,#5b8def,#60a5fa)", borderRadius:"2px", transition:"width 0.1s linear", boxShadow:"0 0 10px rgba(59,130,246,0.7)" }} />
        </div>
      </div>

      <style>{`@keyframes boot-glow{0%,100%{box-shadow:0 0 40px rgba(59,130,246,.55),0 0 80px rgba(59,130,246,.2)}50%{box-shadow:0 0 60px rgba(59,130,246,.85),0 0 120px rgba(59,130,246,.38)}}`}</style>
    </div>
  );
}

// ─── OTP — 6 cases séparées ───────────────────────────────────────────────────

function OtpInput({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  const inputs = useRef<(HTMLInputElement|null)[]>([]);

  const handleChange = useCallback((i:number, raw:string) => {
    const d = raw.replace(/\D/g,"").slice(-1);
    const next = (value.slice(0,i)+d+value.slice(i+1)).slice(0,6);
    onChange(next);
    if (d && i < 5) setTimeout(() => inputs.current[i+1]?.focus(), 0);
  }, [value, onChange]);

  const handleKeyDown = useCallback((i:number, e:React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) {
      inputs.current[i-1]?.focus();
      onChange(value.slice(0, i-1));
    }
  }, [value, onChange]);

  const handlePaste = useCallback((e:React.ClipboardEvent) => {
    const p = e.clipboardData.getData("text").replace(/\D/g,"").slice(0,6);
    if (p) { onChange(p); inputs.current[Math.min(p.length, 5)]?.focus(); e.preventDefault(); }
  }, [onChange]);

  return (
    <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
      {Array.from({length:6}).map((_,i) => (
        <input
          key={i}
          ref={el => { inputs.current[i] = el; }}
          type="text" inputMode="numeric" maxLength={1}
          value={value[i] ?? ""}
          autoFocus={i === 0}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          style={{
            width:"46px", height:"58px", textAlign:"center",
            fontSize:"22px", fontWeight:900,
            borderRadius:"12px", outline:"none",
            border:      value[i] ? "2px solid #5b8def" : "2px solid #e2e8f0",
            background:  value[i] ? "#eff6ff" : "#f4f6f9",
            color:       value[i] ? "#1d4ed8" : "#1a202c",
            boxShadow:   value[i] ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
            transition:  "all 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// ─── Page principale ──────────────────────────────────────────────────────────

export default function LoginPage() {
  const { dark, setDark }         = useAppStore();
  const router                    = useRouter();
  const [isClient, setIsClient]   = useState(false);
  const [step, setStep]           = useState<"credentials"|"otp">("credentials");
  const [login, setLogin]         = useState("");
  const [password, setPassword]   = useState("");
  const [otpCode, setOtpCode]     = useState("");
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState("");
  const [booting, setBooting]     = useState(false);
  const [bootName, setBootName]   = useState("");

  useEffect(() => { setIsClient(true); }, []);
  if (!isClient) return null;
  if (booting)   return <SystemBootOverlay username={bootName} />;

  // Stats extraites des données simulées
  const total    = MOCK_SERVERS.length;
  const online   = MOCK_SERVERS.filter(s => s.status === "online").length;
  const alerts   = MOCK_SERVERS.filter(s => s.status === "degraded" || s.disk >= 80).length;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setMessage(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({login,password}) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Identifiants invalides"); return; }
      setMessage(data.message); setStep("otp");
    } catch { setError("Erreur de connexion au serveur."); }
    finally { setLoading(false); }
  };

  const handleOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/validate-otp", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({login,otpCode}) });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Code incorrect"); return; }
      setBootName(data.user?.firstname || login.split("@")[0]);
      setBooting(true);
      setTimeout(() => { router.push("/dashboard"); }, 2000);
    } catch { setError("Erreur de validation."); }
    finally { setLoading(false); }
  };

  const resendOtp = async () => {
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({login,password}) });
      const d   = await res.json();
      if (res.ok) { setMessage(d.message); setOtpCode(""); }
    } finally { setLoading(false); }
  };

  const inputCls = [
    "w-full pl-10 pr-4 py-3.5 rounded-xl outline-none text-[15px] transition-all",
    "border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-300",
    "focus:border-blue-400 focus:bg-white focus:shadow-sm focus:shadow-blue-100",
  ].join(" ");

  return (
    <div className="min-h-screen flex" style={{ fontFamily:"'Inter',system-ui,sans-serif" }}>

      {/* ══════════════════════════════════════════════════════════
          PANNEAU GAUCHE — dark, vivant, métriques simulées
          ══════════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[52%] xl:w-[56%] relative flex-col overflow-hidden"
        style={{ background:"linear-gradient(145deg,#04091a 0%,#060e1e 55%,#091427 100%)" }}
      >
        {/* Réseau animé */}
        <NetworkCanvas />

        {/* Halo radial subtil */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background:"radial-gradient(ellipse 65% 55% at 38% 58%, rgba(59,130,246,0.07) 0%, transparent 68%)" }}
        />

        {/* Contenu positionné au-dessus du canvas */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">

          {/* ── Logo ── */}
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background:"linear-gradient(135deg,#5b8def,#1d4ed8)", boxShadow:"0 4px 18px rgba(59,130,246,0.42)" }}
            >
              <Server style={{ width:17, height:17, color:"#fff" }} />
            </div>
            <div>
              <span className="text-white font-black text-[17px] tracking-tight">NebulOps</span>
              <span
                className="ml-2 text-[9px] font-bold tracking-[0.15em] uppercase"
                style={{ color:"rgba(59,130,246,0.7)" }}
              >v1.0</span>
            </div>
          </div>

          {/* ── Centre ── */}
          <div className="flex-1 flex flex-col justify-center gap-9">

            {/* Badge + headline */}
            <div>
              <div className="flex items-center gap-2 mb-5">
                <span
                  className="inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase px-3 py-1.5 rounded-full"
                  style={{ background:"rgba(59,130,246,0.1)", color:"#60a5fa", border:"1px solid rgba(59,130,246,0.22)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                  Infrastructure Monitor
                </span>
              </div>

              <h1 className="text-[38px] xl:text-[46px] font-black text-white leading-[1.08] tracking-tight">
                Surveillance<br />
                <span style={{ color:"#5b8def" }}>temps réel</span><br />
                de vos serveurs
              </h1>
              <p className="text-slate-500 text-[14px] mt-5 leading-relaxed max-w-[320px]">
                Métriques live, alertes proactives et gestion centralisée de votre parc infrastructure multi-cloud.
              </p>
            </div>

            {/* ── Stat pills ── */}
            <div className="flex flex-wrap gap-3">
              {[
                { icon:Server,    label:"Serveurs",   value:String(total), alert:false },
                { icon:Activity,  label:"En ligne",   value:String(online), alert:false },
                { icon:HardDrive, label:"Alertes",    value:String(alerts), alert:true  },
              ].map(({ icon:Icon, label, value, alert }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl"
                  style={{
                    background: alert ? "rgba(244,63,94,0.09)"   : "rgba(59,130,246,0.08)",
                    border:     alert ? "1px solid rgba(244,63,94,0.2)" : "1px solid rgba(59,130,246,0.16)",
                  }}
                >
                  <Icon style={{ width:14, height:14, color: alert ? "#d95565" : "#60a5fa" }} />
                  <div>
                    <div className="text-[16px] font-black leading-none" style={{ color: alert ? "#d95565" : "#e2eaf5" }}>{value}</div>
                    <div className="text-[10px] text-slate-600 mt-0.5">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* ── Ticker métriques live ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" style={{ animation:"pulse 2s infinite" }} />
                <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-slate-600">Métriques live</span>
              </div>
              <div
                className="rounded-2xl overflow-hidden"
                style={{ background:"rgba(8,16,32,0.65)", border:"1px solid rgba(59,130,246,0.1)", backdropFilter:"blur(6px)" }}
              >
                <MetricTicker />
              </div>
            </div>
          </div>

          {/* ── Footer gauche ── */}
          <div className="flex items-center justify-between pt-5 border-t border-white/[0.05]">
            <span className="text-[11px] text-slate-700 font-medium">© 2026 NebulOps</span>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              <span className="text-[11px] text-slate-600">Tous systèmes opérationnels</span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          PANNEAU DROIT — formulaire épuré
          ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-white">

        {/* Barre sup */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-slate-100">
          {/* Logo mobile */}
          <div className="flex items-center gap-2.5 lg:invisible">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background:"linear-gradient(135deg,#5b8def,#1d4ed8)" }}>
              <Server style={{ width:14, height:14, color:"#fff" }} />
            </div>
            <span className="font-black text-slate-900 text-sm">NebulOps</span>
          </div>
          <button
            onClick={() => setDark(!dark)}
            className="ml-auto text-[11px] font-semibold text-slate-400 hover:text-slate-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-50 border border-slate-100"
          >
            {dark ? "☀️ Mode clair" : "🌙 Mode sombre"}
          </button>
        </div>

        {/* Formulaire centré */}
        <div className="flex-1 flex items-center justify-center px-8 py-10">
          <div className="w-full max-w-[380px]">

            {/* Retour (étape OTP) */}
            {step === "otp" && (
              <button
                onClick={() => { setStep("credentials"); setError(""); setOtpCode(""); }}
                className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-400 hover:text-blue-600 transition-colors mb-6 group"
              >
                <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
                Retour
              </button>
            )}

            {/* Titre + sous-titre */}
            <div className="mb-8">
              <h2 className="text-[32px] font-black text-slate-900 tracking-tight leading-none">
                {step === "credentials" ? "Connexion" : "Vérification"}
              </h2>
              <p className="text-slate-400 text-[15px] mt-3 leading-snug">
                {step === "credentials"
                  ? "Accédez à votre tableau de bord infrastructure."
                  : <>Code envoyé à <span className="font-bold text-slate-700">{login}</span></>
                }
              </p>
            </div>

            {/* Alertes */}
            {error && (
              <div className="mb-5 flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-red-50 border border-red-100 text-red-600 text-[13px]">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {message && step === "otp" && !error && (
              <div className="mb-5 flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-[13px]">
                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{message}</span>
              </div>
            )}

            {/* ── Formulaire credentials ── */}
            {step === "credentials" && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400 mb-2.5">
                    Email ou Mobile
                  </label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-300 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                    <input type="text" autoComplete="username" placeholder="votre@email.com"
                      value={login} onChange={e => setLogin(e.target.value)} required
                      className={inputCls} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-[12px] font-bold uppercase tracking-[0.1em] text-slate-400">Mot de passe</label>
                    <Link href="/reset-password" className="text-[12px] font-semibold text-blue-500 hover:text-blue-700 transition-colors">
                      Mot de passe oublié ?
                    </Link>
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-blue-500 transition-colors pointer-events-none" />
                    <input type="password" autoComplete="current-password" placeholder="••••••••"
                      value={password} onChange={e => setPassword(e.target.value)} required
                      className={inputCls} />
                  </div>
                </div>

                <button
                  type="submit" disabled={loading || !login || !password}
                  className="w-full mt-2 py-4 rounded-xl font-bold text-[16px] text-white transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{ background:"linear-gradient(135deg,#5b8def,#1d4ed8)", boxShadow:"0 4px 20px rgba(59,130,246,0.3)" }}
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Continuer →"}
                </button>

                {/* Séparateur */}
                <div className="flex items-center gap-3 py-3">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-[12px] text-slate-400 font-bold tracking-wider uppercase">Authentification sécurisée 2FA</span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                {/* Trust badges */}
                <div className="flex items-center justify-center gap-8">
                  <div className="flex items-center gap-2 text-[14px] text-slate-500 font-bold">
                    <ShieldCheck className="w-5 h-5 text-emerald-500" /> 2FA activé
                  </div>
                  <div className="flex items-center gap-2 text-[14px] text-slate-500 font-bold">
                    <Lock className="w-5 h-5 text-blue-500" /> Chiffrement TLS
                  </div>
                </div>
              </form>
            )}

            {/* ── Formulaire OTP ── */}
            {step === "otp" && (
              <form onSubmit={handleOtp} className="space-y-6">
                <div className="flex justify-center">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background:"linear-gradient(135deg,rgba(59,130,246,0.09),rgba(29,78,216,0.05))", border:"1.5px solid rgba(59,130,246,0.16)" }}
                  >
                    <ShieldCheck className="w-7 h-7 text-blue-500" />
                  </div>
                </div>

                <div className="text-center">
                  <p className="text-[13px] text-slate-500">Saisissez le code à 6 chiffres envoyé à votre adresse email.</p>
                  <p className="text-[11px] text-slate-400 mt-1">Valide pendant 5 minutes.</p>
                </div>

                <OtpInput value={otpCode} onChange={setOtpCode} />

                <button
                  type="submit" disabled={loading || otpCode.length < 6}
                  className="w-full py-3.5 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                  style={{ background:"linear-gradient(135deg,#5b8def,#1d4ed8)", boxShadow:"0 4px 20px rgba(59,130,246,0.26)" }}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Valider l'accès →"}
                </button>

                <p className="text-center text-[12px] text-slate-400">
                  Code non reçu ?{" "}
                  <button type="button" disabled={loading} onClick={resendOtp}
                    className="text-blue-500 font-semibold hover:text-blue-700 transition-colors disabled:opacity-40">
                    Renvoyer le code
                  </button>
                </p>
              </form>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-slate-100">
          <p className="text-[11px] text-slate-300 text-center font-medium">
            © 2026 NebulOps — Infrastructure Management Platform
          </p>
        </div>
      </div>
    </div>
  );
}
