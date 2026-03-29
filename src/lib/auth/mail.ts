/**
 * lib/auth/mail.ts
 * ────────────────
 * Service d'envoi d'emails via Nodemailer (adapté du module NestJS).
 * Utilise les templates Handlebars dans src/mail/templates/.
 */

import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: parseInt(process.env.MAIL_PORT || "587"),
  secure: process.env.MAIL_SECURE === "true",
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

interface MailData {
  email: string;
  sujet: string;
  templateName: string;
  context: Record<string, string | number | undefined | null>;
}

/**
 * Charge un template Handlebars et remplace les variables {{data.xxx}}.
 */
function loadTemplate(
  templateName: string,
  context: Record<string, string | number | undefined | null>
): string {
  const templatePath = path.join(
    process.cwd(),
    "src",
    "mail",
    "templates",
    `${templateName}.hbs`
  );

  try {
    let html = fs.readFileSync(templatePath, "utf-8");

    // Remplacer les variables {{data.xxx}} par les valeurs du context
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\{\\{data\\.${key}\\}\\}`, "g");
      html = html.replace(regex, String(value ?? ""));
    }

    return html;
  } catch (error) {
    console.error(`[MAIL] Template ${templateName} non trouvé:`, error);
    return `<p>${context.otp || context.password || "Information"}</p>`;
  }
}

/**
 * Envoie un email en utilisant un template Handlebars.
 */

