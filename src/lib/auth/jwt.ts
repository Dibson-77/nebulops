/**
 * lib/auth/jwt.ts
 * ───────────────
 * Génération et vérification de JWT (access + refresh tokens).
 */

import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY || "";
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || "";
const ACCESS_EXPIRE_MIN = parseInt(process.env.ACCESS_TOKEN_EXPIRE_MINUTES || "60");
const REFRESH_EXPIRE_DAYS = parseInt(process.env.REFRESH_TOKEN_EXPIRE_DAYS || "7");

export interface AccessTokenPayload {
  sub: number;
  email: string;
  firstname: string;
  lastname: string;
  profileId: number;
  profileLabel: string;
  type: "access";
}

export interface RefreshTokenPayload {
  userId: number;
  type: "refresh";
}

export function generateAccessToken(user: {
  id: number;
  email: string;
  firstname?: string | null;
  lastname?: string | null;
  profileId: number;
  profileLabel: string;
}): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    email: user.email,
    firstname: user.firstname || "",
    lastname: user.lastname || "",
    profileId: user.profileId,
    profileLabel: user.profileLabel,
    type: "access",
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: `${ACCESS_EXPIRE_MIN}m`,
  });
}

export function generateRefreshToken(userId: number): string {
  const payload: RefreshTokenPayload = {
    userId,
    type: "refresh",
  };

  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: `${REFRESH_EXPIRE_DAYS}d`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as unknown as AccessTokenPayload;
    if (decoded.type !== "access") return null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as unknown as RefreshTokenPayload;
    if (decoded.type !== "refresh") return null;
    return decoded;
  } catch {
    return null;
  }
}
