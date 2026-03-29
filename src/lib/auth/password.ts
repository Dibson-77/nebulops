/**
 * lib/auth/password.ts
 * ────────────────────
 * Hash, comparaison et vérification de l'historique des mots de passe.
 */

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hashedPassword);
}

/**
 * Vérifie si un mot de passe est identique à l'un des 3 derniers stockés.
 * Retourne true si le mot de passe a déjà été utilisé récemment.
 */
export async function isPasswordReused(
  userId: number,
  newPassword: string
): Promise<boolean> {
  const recentPasswords = await prisma.passwordStore.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 3,
  });

  const checks = await Promise.all(
    recentPasswords.map((entry) =>
      bcrypt.compare(newPassword, entry.password)
    )
  );

  return checks.some((match) => match);
}

/**
 * Enregistre le nouveau mot de passe dans l'historique.
 */
export async function storePassword(
  userId: number,
  hashedPassword: string
): Promise<void> {
  await prisma.passwordStore.create({
    data: { userId, password: hashedPassword },
  });
}
