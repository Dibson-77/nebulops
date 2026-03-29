/**
 * lib/auth/otp.ts
 * ───────────────
 * Génération et vérification OTP via speakeasy (TOTP).
 * Step = 300s (5 minutes), window = 1 intervalle de tolérance.
 */

import speakeasy from "speakeasy";

/**
 * Génère un secret unique puis un token OTP pour un userId.
 * Retourne le token (à envoyer par email) et le secret (à stocker en DB).
 */
export function generateOtp(userId: number): { token: string; secret: string } {
  const userSecret = speakeasy.generateSecret({
    name: `nebulops-${userId}`,
    length: 20,
  });

  const token = speakeasy.totp({
    secret: userSecret.base32,
    encoding: "base32",
    step: 300, // 5 minutes
  });

  return {
    token,
    secret: userSecret.base32,
  };
}

/**
 * Vérifie un token OTP par rapport au secret stocké en DB.
 */
export function verifyOtp(secretBase32: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret: secretBase32,
    encoding: "base32",
    token,
    step: 300,
    window: 1, // tolérance d'un intervalle
  });
}
