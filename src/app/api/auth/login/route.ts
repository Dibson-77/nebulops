/**
 * POST /api/auth/login
 * ────────────────────
 * Étape 1 de l'auth 2FA : vérifie email/password → envoie OTP par email.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { comparePassword } from "@/lib/auth/password";
import { generateOtp } from "@/lib/auth/otp";
import { sendEmail } from "@/lib/auth/mail";

const MAX_LOGIN_RETRIES = parseInt(process.env.MAX_LOGIN_RETRIES || "3");

export async function POST(req: NextRequest) {
  try {
    const { login, password } = await req.json();

    if (!login || !password) {
      return NextResponse.json(
        { error: "Login et mot de passe requis" },
        { status: 400 }
      );
    }

    // Recherche de l'utilisateur par email ou numéro de téléphone
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login }, { phoneNumber: login }],
        deletedAt: null,
      },
      include: { profile: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Login ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    // Vérification du statut INACTIVE
    if (user.status === "INACTIVE") {
      return NextResponse.json(
        { error: "Vous n'avez plus accès au site. Veuillez contacter l'administrateur." },
        { status: 403 }
      );
    }

    // Vérification du statut BLOCKED
    if (user.status === "BLOCKED") {
      return NextResponse.json(
        { error: "Votre compte est temporairement verrouillé. Réessayez plus tard." },
        { status: 403 }
      );
    }

    // Vérification du mot de passe
    const passwordValid = await comparePassword(password, user.password);

    if (!passwordValid) {
      const newRetry = (user.retry || 0) + 1;

      // Bloquer le compte si le nombre max de tentatives est atteint
      if (newRetry >= MAX_LOGIN_RETRIES) {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            status: "BLOCKED",
            lockedAt: new Date(),
            retry: newRetry,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: user.id,
            action: "ACCOUNT_BLOCKED",
            target: "Plusieurs tentatives échouées",
            ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
          },
        });

        return NextResponse.json(
          { error: "Votre compte est bloqué après plusieurs tentatives. Contactez l'administrateur." },
          { status: 403 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { retry: newRetry },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "LOGIN_FAILED",
          target: "Mot de passe incorrect",
          ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
        },
      });

      return NextResponse.json(
        { error: "Login ou mot de passe incorrect." },
        { status: 401 }
      );
    }

    // Génération d'un code OTP
    const { token, secret } = generateOtp(user.id);

    // Stockage du code OTP + reset des tentatives
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: secret,
        retry: 0,
      },
    });

    // Envoi de l'email avec le code OTP
    await sendEmail({
      email: user.email,
      sujet: "CODE DE VERIFICATION",
      templateName: "code-otp-template",
      context: {
        lastname: user.lastname,
        firstname: user.firstname,
        otp: token,
      },
    });

    return NextResponse.json({
      message: "Un code de vérification a été envoyé à votre adresse email.",
      // Indique si c'est une première connexion (le frontend devra demander le changement de mdp)
      isFirstLogin: user.isFirstLogin === "FIRST_LOGIN",
    });
  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
