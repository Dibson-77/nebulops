"use client";

/**
 * src/app/reset-password/page.tsx — NebulOps Reset Password Page
 * ─────────────────────────────────────────────────────────────
 * Flux en 3 étapes :
 *   1. Demande (Email)
 *   2. Vérification (Code OTP)
 *   3. Changement (Nouveau mdp)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/use-app-store";
import {
  Mail, Lock, ShieldCheck, ArrowLeft,
  Loader2, AlertCircle, CheckCircle2,
  Server, Activity, HardDrive, Cpu,
  Eye, EyeOff, KeyRound
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface Node { x:number; y:number; vx:number; vy:number; r:number; pulse:number; }

// ─── Canvas (Réutilisé de la page de login pour cohérence) ───────────────────
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
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
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
      for (let i = 0; i < nodes.current.length; i++) {
        for (let j = i + 1; j < nodes.current.length; j++) {
          const dx = nodes.current[i].x - nodes.current[j].x;
          const dy = nodes.current[i].y - nodes.current[j].y;
          const d  = Math.hypot(dx, dy);
          if (d < 125) {
            ctx.beginPath(); ctx.moveTo(nodes.current[i].x, nodes.current[i].y);
            ctx.lineTo(nodes.current[j].x, nodes.current[j].y);
            ctx.strokeStyle = `rgba(59,130,246,${(1 - d / 125) * 0.22})`;
            ctx.lineWidth = 0.75; ctx.stroke();
          }
        }
      }
      nodes.current.forEach(n => {
        const g = Math.sin(n.pulse) * 0.5 + 0.5;
        const gr = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
        gr.addColorStop(0, `rgba(255, 255, 255, ${0.18 * g})`);
        gr.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2);
        ctx.fillStyle = gr; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.85 + 0.15 * g})`; ctx.fill();
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { mounted.current = false; cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ opacity: 0.72 }} />;
}

// ─── Ticker (Simulé) ────────────────────────────────────────────────────────
const MOCK_SERVERS = [
  { name:"PROD SMC",        ip:"54.37.65.15",    status:"degraded" },
  { name:"DATA / STOCKAGE", ip:"51.91.77.193",   status:"online"   },
  { name:"EAV3",            ip:"107.20.28.186",  status:"online"   },
];

function MetricTicker() {
  const [idx, setIdx] = useState(0);
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
    <div style={{ transition:"all 0.28s", opacity: visible ? 1 : 0, transform: visible ? "scale(1)" : "scale(0.98)", padding:"12px 14px", borderRadius:"12px", background:"rgba(59,130,246,0.05)", border:"1px solid rgba(59,130,246,0.12)" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
        <div style={{ width:"8px", height:"8px", borderRadius:"50%", background: srv.status === "online" ? "#4dab8a" : "#d4a843" }} />
        <span style={{ fontSize:"12px", fontWeight:800, color:"#c7d8f5", fontFamily:"'JetBrains Mono',monospace" }}>{srv.name} (Protected)</span>
      </div>
    </div>
  );
}

// ─── OTP Input ───────────────────────────────────────────────────────────────
function OtpInput({ value, onChange }: { value:string; onChange:(v:string)=>void }) {
  const inputs = useRef<(HTMLInputElement|null)[]>([]);
  const handleChange = useCallback((i:number, raw:string) => {
    const d = raw.replace(/\D/g,"").slice(-1);
    const next = (value.slice(0,i)+d+value.slice(i+1)).slice(0,6);
    onChange(next);
    if (d && i < 5) setTimeout(() => inputs.current[i+1]?.focus(), 0);
  }, [value, onChange]);
  const handleKeyDown = useCallback((i:number, e:React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !value[i] && i > 0) { inputs.current[i-1]?.focus(); onChange(value.slice(0, i-1)); }
  }, [value, onChange]);
  return (
    <div style={{ display:"flex", gap:"10px", justifyContent:"center" }}>
      {Array.from({length:6}).map((_,i) => (
        <input key={i} ref={el => { inputs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={value[i] ?? ""} autoFocus={i === 0}
          onChange={e => handleChange(i, e.target.value)} onKeyDown={e => handleKeyDown(i, e)}
          style={{ width:"46px", height:"58px", textAlign:"center", fontSize:"22px", fontWeight:900, borderRadius:"12px", outline:"none", border: value[i] ? "2px solid #5b8def" : "2px solid #e2e8f0", background: value[i] ? "#eff6ff" : "#f4f6f9", color: value[i] ? "#1d4ed8" : "#1a202c", transition: "all 0.15s" }}
        />
      ))}
    </div>
  );
}

// ─── PAGE PRINCIPALE ──────────────────────────────────────────────────────────
export default function ResetPasswordPage() {
  const { dark, setDark } = useAppStore();
  const [step, setStep] = useState<"request"|"verify"|"reset">("request");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showPass, setShowPass] = useState(false);

  // Étape 1 : Demande de réinitialisation
  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setSuccess(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password/request", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email })
      });
      const data = await res.json();
      
      if (res.status === 409) {
        setSuccess("Une demande est déjà en cours. Saisissez votre code.");
        setStep("verify");
        setLoading(false);
        return;
      }

      if (!res.ok) { setError(data.error || "Une erreur est survenue."); return; }
      setSuccess(data.message);
      setStep("verify");
    } catch { setError("Impossible de joindre le serveur."); }
    finally { setLoading(false); }
  };

  // Étape 2 & 3 : Validation OTP + Nouveau mot de passe
  const handleResetFinal = async (e: React.FormEvent) => {
    e.preventDefault(); setError(""); setLoading(true);
    if (newPassword !== confirmPassword) { setError("Les mots de passe ne sont pas identiques."); setLoading(false); return; }
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otpCode, password: newPassword, confirmPassword })
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Échec de la réinitialisation."); return; }
      setSuccess("Mot de passe mis à jour avec succès ! Redirection...");
      setTimeout(() => { window.location.href = "/"; }, 2000);
    } catch { setError("Erreur serveur lors de la mise à jour."); }
    finally { setLoading(false); }
  };

  const inputCls = "w-full pl-11 pr-11 py-3.5 rounded-xl border border-slate-200 bg-slate-50 text-[14px] text-slate-900 outline-none focus:border-blue-400 focus:bg-white transition-all";

  return (
    <div className="min-h-screen flex" style={{ fontFamily:"'Inter',sans-serif" }}>
      
      {/* GAUCHE — Premium Stats Panel */}
      <div className="hidden lg:flex lg:w-[48%] relative flex-col overflow-hidden" 
           style={{ background:"linear-gradient(145deg,#04091a 0%,#060e1e 55%,#091427 100%)" }}>
        <NetworkCanvas />
        <div className="relative z-10 flex flex-col h-full p-12">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-600 shadow-blue-500/40 shadow-lg">
              <Server size={18} color="#fff" />
            </div>
            <span className="text-white font-black text-lg tracking-tight">NebulOps</span>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <h1 className="text-4xl xl:text-5xl font-black text-white leading-tight mb-6">
              Sécurité <br/><span className="text-blue-500">renforcée</span>
            </h1>
            <p className="text-slate-400 text-sm leading-relaxed max-w-sm mb-12">
              Le processus de réinitialisation est protégé par une authentification à double facteur pour garantir l'intégrité de votre infrastructure.
            </p>
            <MetricTicker />
          </div>
          
          <div className="flex items-center gap-2 pt-6 border-t border-white/5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[11px] text-slate-600 font-medium">Session sécurisée via AES-256</span>
          </div>
        </div>
      </div>

      {/* DROITE — Formulaire */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-50">
          <button onClick={() => window.location.href = "/"} 
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-blue-600 transition-colors group">
            <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" />
            Retour connexion
          </button>
          <button onClick={() => setDark(!dark)} className="text-xs font-bold text-slate-400 px-3 py-1.5 rounded-lg border border-slate-100 uppercase tracking-wider">
            {dark ? "clair" : "sombre"}
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center px-8">
          <div className="w-full max-w-sm">
            
            <div className="mb-10 text-center lg:text-left">
              <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">
                {step === "request" && "Mot de passe oublié ?"}
                {step === "verify" && "Vérification"}
                {step === "reset" && "Nouveau mot de passe"}
              </h2>
              <p className="text-slate-400 text-[13px] leading-relaxed">
                {step === "request" && "Entrez votre email pour recevoir un code de sécurité."}
                {step === "verify" && <>Code envoyé à <span className="font-bold text-slate-700">{email}</span></>}
                {step === "reset" && "Choisissez un nouveau mot de passe robuste."}
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-xs animate-in fade-in slide-in-from-top-1">
                <AlertCircle size={14} className="mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="mb-6 flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 text-xs animate-in fade-in slide-in-from-top-1">
                <CheckCircle2 size={14} className="mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            {step === "request" && (
              <form onSubmit={handleRequest} className="space-y-6">
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                  <input type="email" placeholder="votre@email.com" value={email} onChange={e=>setEmail(e.target.value)} required className={inputCls} />
                </div>
                <button type="submit" disabled={loading || !email} 
                        className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
                        style={{ background:"linear-gradient(135deg,#5b8def,#1d4ed8)" }}>
                  {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Recevoir le code"}
                </button>
              </form>
            )}

            {step === "verify" && (
              <div className="space-y-6">
                <OtpInput value={otpCode} onChange={v => setOtpCode(v)} />
                <button onClick={() => setStep("reset")} disabled={otpCode.length < 6}
                        className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
                        style={{ background:"linear-gradient(135deg,#5b8def,#1d4ed8)" }}>
                  Continuer
                </button>
                <div className="text-center">
                  <button onClick={() => setStep("request")} className="text-slate-400 font-bold text-[11px] uppercase tracking-wider hover:text-slate-600 transition-colors mb-4">
                    ← Utiliser un autre email
                  </button>
                  <p className="text-xs text-slate-400 mb-2">Vous n'avez pas reçu le code ?</p>
                  <button onClick={handleRequest} className="text-blue-500 font-bold text-xs hover:underline uppercase tracking-wider">Renvoyer</button>
                </div>
              </div>
            )}

            {step === "reset" && (
              <form onSubmit={handleResetFinal} className="space-y-4">
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                  <input type={showPass ? "text" : "password"} placeholder="Nouveau mot de passe" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required className={inputCls} />
                  <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500">
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="relative group">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={16} />
                  <input type={showPass ? "text" : "password"} placeholder="Confirmez le mot de passe" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required className={inputCls} />
                </div>
                <button type="submit" disabled={loading || !newPassword || newPassword !== confirmPassword} 
                        className="w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest text-white shadow-xl shadow-blue-500/25 active:scale-[0.98] transition-all disabled:opacity-50"
                        style={{ background:"linear-gradient(135deg,#5b8def,#1d4ed8)" }}>
                  {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : "Mettre à jour"}
                </button>
                <button type="button" onClick={() => setStep("verify")} className="w-full text-slate-400 font-bold text-[11px] uppercase tracking-wider text-center py-2 hover:text-slate-600 transition-colors">
                  ← Vérifier le code OTP
                </button>
              </form>
            )}

          </div>
        </div>

        <div className="px-8 py-6 text-center">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">© 2026 NebulOps Protection System</p>
        </div>
      </div>
    </div>
  );
}
