import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { getWhatsAppStatus, initWhatsApp, disconnectWhatsApp } from "@/lib/alerts/whatsapp-free";

/**
 * GET /api/admin/whatsapp-status
 */
export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  return NextResponse.json(await getWhatsAppStatus());
}

/**
 * POST /api/admin/whatsapp-status
 * body: { action: "connect" | "disconnect" }
 */
export async function POST(req: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const { action } = await req.json();

  if (action === "connect") {
    // Démarre le service si inaccessible, sinon envoie juste /init
    await ensureServiceRunning();
    await initWhatsApp();
    return NextResponse.json({ ok: true });
  }

  if (action === "disconnect") {
    await disconnectWhatsApp();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Action invalide" }, { status: 400 });
}

// ─── Démarrage automatique du service ────────────────────────────────────────

const g = globalThis as any;

async function ensureServiceRunning(): Promise<void> {
  // Tester si le service répond déjà
  const status = await getWhatsAppStatus();
  if (status.state !== "error") return; // service déjà up

  // Éviter les lancements multiples
  if (g._waServiceProc) return;

  const { spawn } = await import("child_process");
  const path = await import("path");

  const servicePath = path.join(process.cwd(), "agent", "whatsapp-service.js");
  const port = process.env.WA_SERVICE_PORT ?? "3007";
  const token = process.env.WA_SERVICE_TOKEN ?? "";

  const args = ["--port", port];
  if (token) args.push("--token", token);

  const proc = spawn("node", [servicePath, ...args], {
    detached: false,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stdout?.on("data", (d: Buffer) => process.stdout.write(`[WA] ${d}`));
  proc.stderr?.on("data", (d: Buffer) => process.stderr.write(`[WA] ${d}`));

  proc.on("exit", (code: number) => {
    console.log(`[WA] Service arrêté (code ${code})`);
    g._waServiceProc = null;
  });

  g._waServiceProc = proc;

  // Attendre que le service soit prêt (max 8s)
  for (let i = 0; i < 16; i++) {
    await new Promise(r => setTimeout(r, 500));
    const s = await getWhatsAppStatus();
    if (s.state !== "error") break;
  }
}
