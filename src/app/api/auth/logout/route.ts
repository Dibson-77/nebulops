/**
 * POST /api/auth/logout
 * ─────────────────────
 * Déconnexion — invalide le refresh token et supprime les cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (refreshToken) {
      // Invalider le refresh token en DB + log la déconnexion
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { refreshToken },
        });

        await tx.user.updateMany({
          where: { refreshToken },
          data: { refreshToken: null },
        });

        if (user) {
          // Mettre à jour le dernier log de connexion
          const latestLog = await tx.loginHistory.findFirst({
            where: { userId: user.id },
            orderBy: { connectedAt: "desc" },
          });

          if (latestLog && !latestLog.disconnectedAt) {
            await tx.loginHistory.update({
              where: { id: latestLog.id },
              data: { disconnectedAt: new Date() },
            });
          }
        }
      });
    }

    // Supprimer les cookies
    cookieStore.delete("access_token");
    cookieStore.delete("refresh_token");

    return NextResponse.json({ message: "Déconnexion réussie" });
  } catch (error) {
    console.error("[POST /api/auth/logout]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
