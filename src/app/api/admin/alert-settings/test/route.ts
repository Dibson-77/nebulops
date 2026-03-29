import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth/session";
import { sendWhatsAppMessage, getWhatsAppStatus } from "@/lib/alerts/whatsapp-free";

/**
 * POST /api/admin/alert-settings/test
 * Envoie un message WhatsApp de test via whatsapp-web.js.
 */
export async function POST() {
  const { error } = await requireAuth();
  if (error) return error;

  const status = await getWhatsAppStatus();
  if (status.state !== "ready") {
    return NextResponse.json({
      ok: false,
      error: `WhatsApp non prêt (état: ${status.state}). ${
        status.state === "qr_pending" ? "Scannez le QR code." : "Connectez WhatsApp dans l'admin."
      }`,
    }, { status: 400 });
  }

  const settings = await prisma.alertSettings.findFirst({ where: { id: 1 } });
  if (!settings?.whatsappEnabled) {
    return NextResponse.json({ ok: false, error: "WhatsApp non activé" }, { status: 400 });
  }

  const result = await sendWhatsAppMessage({
    phone: settings.whatsappTo,
    body:  "✅ *NebulOps* — Test réussi ! Vos alertes WhatsApp sont correctement configurées.",
  });

  return NextResponse.json({ ok: result.success, error: result.error });
}
