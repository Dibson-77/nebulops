/**
 * POST /api/auth/reset-password
 * ─────────────────────────────
 * Réinitialise le mot de passe avec vérification OTP + historique.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyOtp } from "@/lib/auth/otp";
import { hashPassword, isPasswordReused, storePassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/auth/mail";

export async function POST(req: NextRequest) {
  try {
    const { otpCode, password, confirmPassword } = await req.json();

    if (!otpCode || !password || !confirmPassword) {
      return NextResponse.json(
        { error: "Code OTP, mot de passe et confirmation requis" },
        { status: 400 }
      );
    }

    if (password !== confirmPassword) {
      return NextResponse.json(
        { error: "Les mots de passe ne sont pas identiques." },
        { status: 400 }
      );
    }

    // Trouver l'utilisateur en cours de reset
    const user = await prisma.user.findFirst({
      where: {
        otpCode: { not: null },
        isResettingPassword: true,
        deletedAt: null,
      },
    });

    if (!user || !user.otpCode) {
      return NextResponse.json(
        { error: "Code OTP invalide ou utilisateur inexistant." },
        { status: 404 }
      );
    }

    if (user.otpAttempts >= 3) {
      return NextResponse.json(
        { error: "Trop de tentatives. Veuillez faire une nouvelle demande." },
        { status: 429 }
      );
    }

    // Vérifier le code OTP
    const otpValid = verifyOtp(user.otpCode, otpCode);

    if (!otpValid) {
      await prisma.user.update({
        where: { id: user.id },
        data: { otpAttempts: user.otpAttempts + 1 },
      });

      return NextResponse.json(
        { error: "Le code OTP est incorrect ou a expiré." },
        { status: 400 }
      );
    }

    // Vérifier l'historique des mots de passe
    const reused = await isPasswordReused(user.id, password);
    if (reused) {
      return NextResponse.json(
        { error: "Ce mot de passe est identique à l'un des 3 derniers utilisés." },
        { status: 400 }
      );
    }

    const hashed = await hashPassword(password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          isResettingPassword: false,
          password: hashed,
          otpCode: null,
          otpAttempts: 0,
          retry: 0,
          status: "ACTIVE",
        },
      }),
      prisma.passwordStore.create({
        data: { userId: user.id, password: hashed },
      }),
    ]);

    await sendEmail({
      email: user.email,
      sujet: "CONFIRMATION DE REINITIALISATION",
      templateName: "reset-password-succesfuly-template",
      context: {
        lastname: user.lastname,
        password,
        lien: process.env.NEXTAUTH_URL || "http://localhost:3000",
      },
    });

    return NextResponse.json({
      message: "Votre mot de passe a bien été changé.",
    });
  } catch (error) {
    console.error("[POST /api/auth/reset-password]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
