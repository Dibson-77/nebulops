/**
 * lib/alerts/whatsapp.ts
 * ──────────────────────
 * Envoi de messages WhatsApp via l'API REST Twilio.
 * Pas de SDK — un simple fetch avec Basic Auth suffit.
 */

export interface WhatsAppResult {
  success: boolean;
  sid?: string;
  error?: string;
}

export async function sendWhatsAppMessage(params: {
  to: string;          // Ex: "whatsapp:+2250700000000"
  from: string;        // Ex: "whatsapp:+14155238886"
  body: string;
  accountSid: string;
  authToken: string;
}): Promise<WhatsAppResult> {
  const { to, from, body, accountSid, authToken } = params;

  if (!accountSid || !authToken || !to || !from) {
    return { success: false, error: "Configuration Twilio incomplète" };
  }

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append("To", to);
    formData.append("From", from);
    formData.append("Body", body);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    const data = await res.json();

    if (!res.ok) {
      return { success: false, error: data?.message || `HTTP ${res.status}` };
    }

    return { success: true, sid: data.sid };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}
