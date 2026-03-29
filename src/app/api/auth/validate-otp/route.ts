/**
 * POST /api/auth/validate-otp
 * ───────────────────────────
 * Étape 2 de l'auth 2FA : valide le code OTP → retourne les tokens JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/auth/otp";
import { generateAccessToken, generateRefreshToken } from "@/lib/auth/jwt";

export async function POST(req: NextRequest) {
  try {
    const { login, otpCode } = await req.json();

    if (!login || !otpCode) {
      return NextResponse.json(
        { error: "Login et code OTP requis" },
        { status: 400 }
      );
    }

    // Recherche de l'utilisateur
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { phoneNumber: login }],
        deletedAt: null,
      },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable." },
        { status: 404 }
      );
    }

    if (user.status === "INACTIVE" || user.status === "BLOCKED") {
      return NextResponse.json(
        { error: "Votre compte est bloqué ou désactivé." },
        { status: 403 }
      );
    }

    if (!user.otpCode) {
      return NextResponse.json(
        { error: "Aucun code de vérification en attente." },
        { status: 400 }
      );
    }

    // Vérification du code OTP
    const isOtpValid = verifyOtp(user.otpCode, otpCode);

    if (!isOtpValid) {
      return NextResponse.json(
        { error: "Code de vérification invalide ou expiré." },
        { status: 401 }
      );
    }

    // Génération des tokens
    const accessToken = generateAccessToken({
      id: user.id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      profileId: user.profile.id,
      profileLabel: user.profile.libelle,
    });

    const refreshToken = generateRefreshToken(user.id);

    // Mise à jour en DB
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          refreshToken,
          otpCode: null,
          lastLoginAt: new Date(),
        },
      });

      // Log de connexion
      await tx.loginHistory.create({
        data: {
          userId: user.id,
          ipAddress: req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown",
          browser: req.headers.get("user-agent")?.split("/")[0] || undefined,
        },
      });

      // Log d'audit
      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN",
          target: "SESSION",
          ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
          createdAt: new Date(),
        },
      });
    });

    // Set cookies httpOnly
    const cookieStore = await cookies();
    cookieStore.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "60") * 60,
    });

    cookieStore.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || "7") * 86400,
    });

    return NextResponse.json({
      data: {
        access_token: accessToken,
        refresh_token: refreshToken,
      },
      user: {
        id: user.id,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        profile: user.profile.libelle,
        isFirstLogin: user.isFirstLogin === "FIRST_LOGIN",
      },
      message: "Connexion réussie",
    });
  } catch (error) {
    console.error("[POST /api/auth/validate-otp]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
