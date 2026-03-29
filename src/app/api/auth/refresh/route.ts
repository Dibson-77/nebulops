/**
 * POST /api/auth/refresh
 * ──────────────────────
 * Rafraîchit le access_token à partir du refresh_token.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyRefreshToken, generateAccessToken } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Token de rafraîchissement manquant." },
        { status: 400 }
      );
    }

    // Vérifier le refresh token
    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      return NextResponse.json(
        { error: "Token de rafraîchissement invalide ou expiré." },
        { status: 401 }
      );
    }

    // Récupérer l'utilisateur
    const user = await prisma.user.findUnique({
      where: {
        id: decoded.userId,
        refreshToken,
      },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Token de rafraîchissement invalide." },
        { status: 401 }
      );
    }

    if (user.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Votre compte n'est plus actif." },
        { status: 403 }
      );
    }

    // Générer un nouveau access token
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      profileId: user.profile.id,
      profileLabel: user.profile.libelle,
    });

    // Mettre à jour le cookie
    cookieStore.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "60") * 60,
    });

    return NextResponse.json({
      data: { access_token: accessToken, refresh_token: refreshToken },
      message: "Rafraîchissement réussi",
    });
  } catch (error) {
    console.error("[POST /api/auth/refresh]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
