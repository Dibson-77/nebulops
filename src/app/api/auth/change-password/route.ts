/**
 * POST /api/auth/change-password
 * ──────────────────────────────
 * Changement de mot de passe pour un utilisateur connecté.
 * Gère aussi le cas de la première connexion.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";
import {
  comparePassword,
  hashPassword,
  isPasswordReused,
  storePassword,
} from "@/lib/auth/password";
import { sendEmail } from "@/lib/auth/mail";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const { oldPassword, newPassword, confirmPassword } = await req.json();

    if (!oldPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: "Ancien mot de passe, nouveau mot de passe et confirmation requis" },
        { status: 400 }
      );
    }

    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: "Les mots de passe ne sont pas identiques." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub, deletedAt: null },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Utilisateur introuvable." },
        { status: 404 }
      );
    }

    // Vérifier l'ancien mot de passe
    const oldValid = await comparePassword(oldPassword, user.password);
    if (!oldValid) {
      return NextResponse.json(
        { error: "L'ancien mot de passe est incorrect." },
        { status: 401 }
      );
    }

    // Vérifier l'historique (sauf première connexion initiale)
    if (user.isFirstLogin !== "FIRST_LOGIN") {
      const reused = await isPasswordReused(user.id, newPassword);
      if (reused) {
        return NextResponse.json(
          { error: "Ce mot de passe est identique à l'un des 3 derniers utilisés." },
          { status: 400 }
        );
      }
    }

    const hashed = await hashPassword(newPassword);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashed,
          isFirstLogin: "NOT_FIRST_LOGIN",
          passwordChangeAt: new Date(),
          retry: 0,
          isResettingPassword: false,
          otpCode: null,
          otpAttempts: 0,
        },
      }),
      prisma.passwordStore.create({
        data: { userId: user.id, password: hashed },
      }),
    ]);

    await sendEmail({
      email: user.email,
      sujet: "CONFIRMATION DE CHANGEMENT DE MOT DE PASSE",
      templateName: "update-password-template",
      context: {
        lastname: user.lastname,
        password: newPassword,
        lien: process.env.NEXTAUTH_URL || "http://localhost:3000",
      },
    });

    return NextResponse.json({
      message: "Votre mot de passe a bien été changé.",
    });
  } catch (error) {
    console.error("[POST /api/auth/change-password]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
