/**
 * POST /api/auth/reset-password/request
 * ──────────────────────────────────────
 * Demande de réinitialisation de mot de passe → envoie OTP par email.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateOtp } from "@/lib/auth/otp";
import { sendEmail } from "@/lib/auth/mail";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email requis" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email, deletedAt: null },
    });

    if (!user) {
      return NextResponse.json(
        { error: "L'utilisateur n'existe pas." },
        { status: 404 }
      );
    }

    if (user.isResettingPassword) {
      return NextResponse.json(
        { error: "Une demande de réinitialisation est déjà en cours." },
        { status: 409 }
      );
    }

    const { token, secret } = generateOtp(user.id);

    await prisma.user.update({
      where: { email },
      data: {
        isResettingPassword: true,
        otpCode: secret,
        otpAttempts: 0,
      },
    });

    await sendEmail({
      email: user.email,
      sujet: "DEMANDE DE REINITIALISATION DE MOT DE PASSE",
      templateName: "code-otp-template",
      context: {
        lastname: user.lastname,
        firstname: user.firstname,
        otp: token,
      },
    });

    return NextResponse.json({
      message: "Veuillez consulter vos emails pour réinitialiser votre mot de passe.",
    });
  } catch (error) {
    console.error("[POST /api/auth/reset-password/request]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
