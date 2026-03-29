/**
 * instrumentation.ts
 * ───────────────────
 * Exécuté au démarrage du serveur Next.js.
 * Le client WhatsApp tourne dans un processus séparé (whatsapp-service.js) —
 * il n'y a rien à initialiser ici.
 */
export async function register() {
  // WhatsApp géré par agent/whatsapp-service.js (processus indépendant)
}
