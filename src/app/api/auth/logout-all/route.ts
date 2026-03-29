/**
 * POST /api/auth/logout-all
 * ─────────────────────────
 * Déconnecte l'utilisateur de TOUTES les sessions.
 * Invalide le refresh token en base et ferme tous les logs de connexion.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const userId = session.sub;

    await prisma.$transaction(async (tx) => {
      // 1. Invalider le refresh token du user
      await tx.user.update({
        where: { id: userId },
        data: { refreshToken: null },
      });

      // 2. Fermer tous les logs de connexion actifs
      await tx.loginHistory.updateMany({
        where: { 
          userId, 
          disconnectedAt: null 
        },
        data: { 
          disconnectedAt: new Date() 
        },
      });

      // 3. Logger l'action d'audit
      await tx.auditLog.create({
        data: {
          userId,
          action: "LOGOUT_ALL",
          target: "SESSIONS",
        },
      });
    });

    // 4. Supprimer les cookies locaux
    const cookieStore = await cookies();
    cookieStore.delete("access_token");
    cookieStore.delete("refresh_token");

    return NextResponse.json({ message: "Toutes les sessions ont été révoquées" });
  } catch (error) {
    console.error("[POST /api/auth/logout-all]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
