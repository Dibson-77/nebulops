import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * src/middleware.ts
 * ─────────────────
 * Gestion centralisée de la sécurité et des redirections.
 * Inspiré du pattern FlowSms.
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;

  // Définition des routes publiques et protégées
  const isAuthPage = pathname === "/";
  const isResetPasswordPage = pathname === "/reset-password";
  const isApiRoute = pathname.startsWith("/api");
  const isStaticFile = 
    pathname.startsWith("/_next") || 
    pathname.includes("favicon.ico") ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".svg");

  // Ne pas intercepter les fichiers statiques et l'API d'auth
  if (isStaticFile || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // 1. Redirection si Déjà Connecté et tente d'aller sur "/"
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 2. Redirection si NON Connecté et tente d'accéder à une route protégée
  // (On protège tout sauf "/" , "/reset-password" et l'API d'auth)
  const isProtectedRoute = !isAuthPage && !isResetPasswordPage && !isApiRoute;
  
  if (!token && isProtectedRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

// Configuration optionnelle pour cibler des routes spécifiques
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
