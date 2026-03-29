#!/usr/bin/env node
/**
 * whatsapp-service.js
 * ────────────────────
 * Micro-service WhatsApp indépendant de Next.js.
 * Session Puppeteer stable — QR scanné UNE SEULE FOIS.
 *
 * Usage:
 *   node whatsapp-service.js [--port 3007] [--token SECRET]
 *
 * Endpoints:
 *   GET  /status      → état du client + QR code base64 si qr_pending
 *   POST /send        → envoie un message  { phone, body }
 *   POST /init        → démarre le client
 *   POST /disconnect  → déconnecte proprement
 *
 * Dépendances (à installer une fois dans le dossier NebulOps) :
 *   npm install whatsapp-web.js qrcode
 */

"use strict";

const http    = require("http");
const { Client, LocalAuth } = require("whatsapp-web.js");
const QRCode  = require("qrcode");
const path    = require("path");

// ─── Config ──────────────────────────────────────────────────────────────────

const args   = process.argv.slice(2);
const getArg = (flag, def) => {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : def;
};

const PORT       = parseInt(getArg("--port",  process.env.WA_SERVICE_PORT  || "3007"));
const AUTH_TOKEN = getArg("--token", process.env.WA_SERVICE_TOKEN || "");
const AUTH_PATH  = path.join(__dirname, "..", ".wwebjs_auth"); // dossier racine NebulOps

// ─── État du client ───────────────────────────────────────────────────────────

let state  = { type: "disconnected" };  // { type, qrCode?, phone?, error? }
let client = null;

// ─── Initialisation WhatsApp ─────────────────────────────────────────────────

async function initClient() {
  if (client) return;

  state = { type: "initializing" };
  log("Initialisation du client WhatsApp…");

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_PATH }),
    puppeteer: {
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
      ],
    },
  });

  client.on("qr", async (qr) => {
    try {
      const dataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
      state = { type: "qr_pending", qrCode: dataUrl };
      log("📱 QR code généré — scannez-le dans NebulOps → Admin → WhatsApp");
    } catch {
      state = { type: "qr_pending" };
    }
  });

  client.on("authenticated", () => {
    state = { type: "authenticated" };
    log("✅ Session WhatsApp authentifiée");
  });

  client.on("ready", () => {
    const phone = client.info?.wid?.user ?? "inconnu";
    state = { type: "ready", phone };
    log(`✅ WhatsApp prêt — bot: +${phone}`);
  });

  client.on("disconnected", (reason) => {
    log(`⚠️ Déconnecté: ${reason}`);
    state  = { type: "disconnected", error: reason };
    client = null;
    // Reconnexion automatique après 30s si session sauvegardée
    setTimeout(() => {
      log("🔄 Tentative de reconnexion automatique…");
      initClient().catch(err => log("❌ Reconnexion échouée:", err.message));
    }, 30_000);
  });

  client.on("auth_failure", (msg) => {
    log(`❌ Auth échouée: ${msg}`);
    state  = { type: "error", error: msg };
    client = null;
  });

  try {
    await client.initialize();
  } catch (err) {
    log("❌ Erreur initialize:", err.message);
    state  = { type: "error", error: err.message };
    client = null;
  }
}

async function disconnectClient() {
  if (client) {
    try { await client.destroy(); } catch { /* ignore */ }
    client = null;
  }
  state = { type: "disconnected" };
  log("Déconnecté manuellement.");
}

// ─── Envoi de message ─────────────────────────────────────────────────────────

async function sendMessage(phone, body) {
  if (!client || state.type !== "ready") {
    return { success: false, error: `Client non prêt (état: ${state.type})` };
  }
  try {
    const digits = phone.replace(/[^0-9]/g, "");
    await client.sendMessage(`${digits}@c.us`, body);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─── Serveur HTTP ─────────────────────────────────────────────────────────────

function log(...args) {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  console.log(`[${ts}] [WA]`, ...args);
}

function json(res, code, data) {
  const body = JSON.stringify(data);
  res.writeHead(code, {
    "Content-Type":  "application/json",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function checkAuth(req, res) {
  if (!AUTH_TOKEN) return true;
  const token = req.headers["x-wa-token"] || req.headers["authorization"]?.replace("Bearer ", "");
  if (token !== AUTH_TOKEN) {
    json(res, 401, { error: "Unauthorized" });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
    res.end();
    return;
  }

  if (!checkAuth(req, res)) return;

  const url = req.url.split("?")[0];

  // ── GET /status
  if (req.method === "GET" && url === "/status") {
    return json(res, 200, state);
  }

  // ── POST /init
  if (req.method === "POST" && url === "/init") {
    initClient().catch(() => {});
    return json(res, 200, { ok: true, message: "Initialisation démarrée" });
  }

  // ── POST /disconnect
  if (req.method === "POST" && url === "/disconnect") {
    await disconnectClient();
    return json(res, 200, { ok: true });
  }

  // ── POST /send
  if (req.method === "POST" && url === "/send") {
    let body = "";
    req.on("data", chunk => (body += chunk));
    req.on("end", async () => {
      try {
        const { phone, body: msgBody } = JSON.parse(body);
        if (!phone || !msgBody) return json(res, 400, { error: "phone et body requis" });
        const result = await sendMessage(phone, msgBody);
        return json(res, result.success ? 200 : 503, result);
      } catch {
        return json(res, 400, { error: "JSON invalide" });
      }
    });
    return;
  }

  json(res, 404, { error: "Not found", endpoints: ["GET /status", "POST /init", "POST /disconnect", "POST /send"] });
});

server.listen(PORT, "0.0.0.0", () => {
  log(`\n╔══════════════════════════════════════════════╗`);
  log(`║       NebulOps WhatsApp Service              ║`);
  log(`╚══════════════════════════════════════════════╝`);
  log(` Port   : ${PORT}`);
  log(` Auth   : ${AUTH_TOKEN ? "token=****" + AUTH_TOKEN.slice(-4) : "désactivée (recommandez --token)"}`);
  log(` Session: ${AUTH_PATH}`);
  log(``);
  log(` Démarrage automatique du client WhatsApp…`);
  log(``);

  // Démarrer le client au lancement
  initClient().catch(err => log("❌ Init error:", err.message));
});

server.on("error", err => {
  log("❌ Serveur HTTP:", err.message);
  process.exit(1);
});

process.on("SIGINT",  () => { disconnectClient().then(() => process.exit(0)); });
process.on("SIGTERM", () => { disconnectClient().then(() => process.exit(0)); });
