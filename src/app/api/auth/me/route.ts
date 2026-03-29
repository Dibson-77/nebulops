/**
 * GET /api/auth/me
 * ────────────────
 * Récupère les informations de l'utilisateur connecté via sa session.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth/session";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
    }

    const user = await prisma.user.findFirst({
      where: { id: session.sub, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstname: true,
        lastname: true,
        phoneNumber: true,
        status: true,
        isFirstLogin: true,
        createdAt: true,
        profile: {
          select: {
            libelle: true,
            id: true,
          }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    // Statistiques & Activités
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);

    const [loginCount, actionCount, recentLogins, recentAudit] = await Promise.all([
      prisma.loginHistory.count({
        where: { userId: session.sub, connectedAt: { gte: firstDay } }
      }),
      prisma.auditLog.count({
        where: { userId: session.sub }
      }),
      prisma.loginHistory.findMany({
        where: { userId: session.sub },
        orderBy: { connectedAt: "desc" },
        take: 3,
      }),
      prisma.auditLog.findMany({
        where: { userId: session.sub },
        orderBy: { createdAt: "desc" },
        take: 3,
      })
    ]);

    // Fusionner et trier les activités
    const activities = [
      ...recentLogins.map(l => ({ 
        label: "Connexion réussie", 
        time: l.connectedAt, 
        ok: true 
      })),
      ...recentAudit.map(a => ({ 
        label: a.action === "LOGIN_FAILED" ? "Tentative échouée" : a.action.replace(/_/g, " "),
        time: a.createdAt, 
        ok: a.action !== "LOGIN_FAILED" && a.action !== "ACCOUNT_BLOCKED"
      }))
    ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 3);

    // Aplatir le profil pour le frontend
    const userData = {
      ...user,
      profileLabel: user.profile?.libelle || "Utilisateur",
      profileCode: String(user.profile?.id || "USER"),
      joinedAt: (user as any).createdAt,
      loginCount,
      actionCount,
      activities
    };

    return NextResponse.json(userData);
  } catch (error) {
    console.error("[GET /api/auth/me]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
