/**
 * lib/alerts/whatsapp-free.ts
 * ────────────────────────────
 * Client HTTP vers le service WhatsApp autonome (whatsapp-service.js).
 *
 * Le service tourne sur son propre processus Node.js (port 3007 par défaut),
 * indépendant de Next.js — QR scanné UNE SEULE FOIS, session persistante.
 *
 * Variables d'environnement :
 *   WA_SERVICE_URL   = http://localhost:3007  (défaut)
 *   WA_SERVICE_TOKEN = (optionnel, même valeur que --token du service)
 */

export type WAState = "disconnected" | "initializing" | "qr_pending" | "authenticated" | "ready" | "error";

export interface WAStatus {
  state:   WAState;
  qrCode?: string;  // base64 PNG — présent quand state === "qr_pending"
  phone?:  string;  // numéro bot — présent quand state === "ready"
  error?:  string;
}

function serviceUrl(path: string) {
  const base = (process.env.WA_SERVICE_URL ?? "http://localhost:3007").replace(/\/$/, "");
  return `${base}${path}`;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.WA_SERVICE_TOKEN;
  if (token) h["X-WA-Token"] = token;
  return h;
}

// ─── API publique ─────────────────────────────────────────────────────────────

export async function getWhatsAppStatus(): Promise<WAStatus> {
  try {
    const res = await fetch(serviceUrl("/status"), {
      headers: headers(),
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    if (!res.ok) return { state: "error", error: `HTTP ${res.status}` };
    const data = await res.json();
    // Le service retourne { type, ... } — normalise en { state, ... }
    return { ...data, state: data.type ?? data.state ?? "disconnected" };
  } catch (err: any) {
    return { state: "error", error: "Service WhatsApp inaccessible — lancez whatsapp-service.js" };
  }
}

export async function initWhatsApp(): Promise<void> {
  await fetch(serviceUrl("/init"), {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
}

export async function disconnectWhatsApp(): Promise<void> {
  await fetch(serviceUrl("/disconnect"), {
    method: "POST",
    headers: headers(),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => {});
}

export async function sendWhatsAppMessage(params: {
  phone: string;
  body:  string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(serviceUrl("/send"), {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ phone: params.phone, body: params.body }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await res.json();
    return { success: data.success ?? res.ok, error: data.error };
  } catch (err: any) {
    return { success: false, error: "Service WhatsApp inaccessible" };
  }
}
