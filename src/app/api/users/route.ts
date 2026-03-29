/**
 * app/api/users/route.ts
 * ───────────────────────
 * GET  /api/users   → liste tous les utilisateurs (admin seulement)
 * POST /api/users   → créer un utilisateur       (admin seulement)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireProfile } from "@/lib/auth/session";
import { hashPassword, storePassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/auth/mail";
import { z } from "zod";

const CreateUserSchema = z.object({
  firstname:   z.string().min(1).max(80),
  lastname:    z.string().min(1).max(80),
  email:       z.string().email(),
  phoneNumber: z.string().optional(),
  profileId:   z.number().int(),
});

import { PaginationService } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireProfile(["Administrateur"]);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(req.url);
    const params = {
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 10,
      search: searchParams.get("search") || undefined,
      all: searchParams.get("all") === "true",
    };

    const result = await PaginationService.paginate("user", params, {
      where: { deletedAt: null },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        email: true,
        phoneNumber: true,
        status: true,
        isFirstLogin: true,
        createdAt: true,
        lastLoginAt: true,
        profile: { select: { id: true, libelle: true } },
      },
      orderBy: { createdAt: "asc" },
      searchables: ["email", "firstname", "lastname"],
    });

    // On s'assure que le "name" est présent pour le frontend (concaténation si besoin)
    const mappedData = result.data.map((u: any) => ({
      ...u,
      name: `${u.firstname} ${u.lastname}`.trim(),
      role: u.profile?.libelle || "Collaborateur",
      active: u.status === "ACTIVE",
    }));

    return NextResponse.json({
      data: mappedData,
      metadata: result.metadata,
    });
  } catch (error) {
    console.error("[GET /api/users]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireProfile(["Administrateur"]);
    if (auth.error) return auth.error;

    const body   = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Données invalides", details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { firstname, lastname, email, phoneNumber, profileId } = parsed.data;

    // Vérifier que l'email n'existe pas déjà
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, ...(phoneNumber ? [{ phoneNumber }] : [])],
        deletedAt: null,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email ou ce numéro de téléphone." },
        { status: 409 }
      );
    }

    // Générer un mot de passe temporaire
    const tempPassword = Math.random().toString(36).slice(-8) + "A1!";
    const hashedPassword = await hashPassword(tempPassword);

    // Créer l'utilisateur
    const user = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          firstname,
          lastname,
          email,
          phoneNumber: phoneNumber || null,
          password: hashedPassword,
          passwordTemporary: tempPassword,
          profileId,
          isFirstLogin: "FIRST_LOGIN",
          status: "ACTIVE",
        },
        include: { profile: true },
      });

      await tx.passwordStore.create({
        data: { userId: u.id, password: hashedPassword },
      });

      return u;
    });

    // Log d'audit
    await prisma.auditLog.create({
      data: {
        userId: auth.session.sub,
        action: "CREATE_USER",
        target: email,
        ip: req.headers.get("x-forwarded-for") || "127.0.0.1",
      },
    });

    // Envoyer l'email de création de compte
    await sendEmail({
      email,
      sujet: "CREATION DE COMPTE",
      templateName: "create-account-template",
      context: {
        lastname,
        firstname,
        email,
        password: tempPassword,
        lien: process.env.NEXTAUTH_URL || "http://localhost:3000",
      },
    });

    return NextResponse.json(
      {
        data: {
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          email: user.email,
          profile: user.profile.libelle,
        },
        message: "Utilisateur créé avec succès. Un email a été envoyé.",
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/users]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
