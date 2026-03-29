/**
 * lib/auth/session.ts
 * ───────────────────
 * Middleware d'authentification pour les API routes Next.js.
 * Lit le access_token depuis les cookies httpOnly.
 */

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyAccessToken, type AccessTokenPayload } from "./jwt";

/**
 * Récupère la session utilisateur depuis le cookie access_token.
 * Retourne null si non authentifié ou token invalide.
 */
export async function getSession(): Promise<AccessTokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/**
 * Middleware qui exige une authentification.
 * Retourne la session ou une réponse 401.
 */
export async function requireAuth(): Promise<
  { session: AccessTokenPayload; error?: never } |
  { session?: never; error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json(
        { error: "Non authentifié" },
        { status: 401 }
      ),
    };
  }
  return { session };
}

/**
 * Vérifie que l'utilisateur a l'un des profils autorisés.
 */
export async function requireProfile(
  allowedProfiles: string[]
): Promise<
  { session: AccessTokenPayload; error?: never } |
  { session?: never; error: NextResponse }
> {
  const result = await requireAuth();
  if (result.error) return result;

  if (!allowedProfiles.includes(result.session.profileLabel)) {
    return {
      error: NextResponse.json(
        { error: "Droits insuffisants" },
        { status: 403 }
      ),
    };
  }

  return result;
}
