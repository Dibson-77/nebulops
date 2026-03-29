/**
 * lib/alerts/notify.ts
 * ─────────────────────
 * Orchestrateur d'alertes WhatsApp avec anti-spam (cooldown par serveur + type d'événement).
 * Chargez AlertSettings UNE FOIS avant la boucle de sync, passez-le en paramètre.
 */

import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "./whatsapp-free";
import type { AlertSettings } from "@prisma/client";
import type { AlertEventType } from "@prisma/client";

/**
 * Envoie une alerte WhatsApp si :
 * 1. WhatsApp est activé dans les settings
 * 2. Aucune alerte du même type pour ce serveur n'a été envoyée dans la fenêtre cooldown
 *
 * @param serverId     ID du serveur concerné
 * @param eventType    Type d'événement (SERVER_OFFLINE, DISK_HIGH, …)
 * @param messageBody  Texte du message WhatsApp
 * @param settings     Singleton AlertSettings (chargé une fois avant la boucle)
 */
export async function triggerAlertIfNeeded(
  serverId: number,
  eventType: AlertEventType,
  messageBody: string,
  settings: AlertSettings
): Promise<void> {
  if (!settings.whatsappEnabled) return;

  // Vérifie le cooldown : y a-t-il déjà eu une alerte pour ce serveur + type dans la fenêtre ?
  const cooldownSince = new Date(Date.now() - settings.cooldownMinutes * 60_000);
  const recent = await prisma.alertNotification.findFirst({
    where: {
      serverId,
      eventType,
      status: "SENT",
      sentAt: { gte: cooldownSince },
    },
  });

  if (recent) {
    // Cooldown actif — on enregistre un SKIPPED pour la traçabilité
    await prisma.alertNotification.create({
      data: { serverId, eventType, status: "SKIPPED", message: messageBody },
    });
    return;
  }

  // Envoi réel via whatsapp-web.js (gratuit)
  const result = await sendWhatsAppMessage({
    phone: settings.whatsappTo,
    body:  messageBody,
  });

  await prisma.alertNotification.create({
    data: {
      serverId,
      eventType,
      status: result.success ? "SENT" : "FAILED",
      message: messageBody,
      errorDetail: result.error ?? null,
    },
  });

  if (!result.success) {
    console.error(`[ALERT] WhatsApp failed for server ${serverId} (${eventType}): ${result.error}`);
  } else {
    console.log(`[ALERT] ✅ WhatsApp sent for server ${serverId} (${eventType})`);
  }
}

/**
 * Charge les AlertSettings depuis la DB (singleton id=1).
 * Crée la ligne avec les valeurs par défaut si elle n'existe pas encore.
 */
export async function loadAlertSettings(): Promise<AlertSettings> {
  // Guard : le modèle peut ne pas exister si le client Prisma n'a pas été régénéré
  // après l'ajout du schéma. Redémarrer le serveur dev résout définitivement ce cas.
  if (!(prisma as any).alertSettings) {
    throw new Error("prisma.alertSettings undefined — redémarrez le serveur dev après prisma generate");
  }

  const settings = await prisma.alertSettings.findFirst({ where: { id: 1 } });
  if (settings) return settings;

  return prisma.alertSettings.create({
    data: { id: 1, updatedAt: new Date() },
  });
}
