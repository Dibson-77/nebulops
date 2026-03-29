import { useAppStore } from "@/store/use-app-store";

/**
 * apiFetch
 * ────────
 * Wrapper autour de fetch qui gère le rafraîchissement automatique du token
 * en cas d'erreur 401 (Unauthorized).
 */

async function attemptRefresh(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", { 
      method: "POST",
      headers: { "Content-Type": "application/json" }
    });
    return res.ok;
  } catch (error) {
    console.error("[apiFetch] Refresh token failed:", error);
    return false;
  }
}

export async function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(url, options);

  // Si on reçoit un 401, on tente de rafraîchir le token
  if (response.status === 401) {
    // Éviter de boucler si c'est déjà l'URL de refresh qui a échoué
    if (url.includes("/api/auth/refresh")) {
      useAppStore.getState().setSessionExpired(true);
      return response;
    }

    const isRefreshed = await attemptRefresh();

    if (isRefreshed) {
      // On re-tente la requête initiale avec le nouveau cookie (automatique via le navigateur)
      return fetch(url, options);
    } else {
      // Échec du refresh -> session expirée
      useAppStore.getState().setSessionExpired(true);
    }
  }

  return response;
}

/**
 * Helpers pour les méthodes courantes
 */
export const api = {
  get: (url: string, options?: RequestInit) => apiFetch(url, { ...options, method: "GET" }),
  post: (url: string, body?: any, options?: RequestInit) => 
    apiFetch(url, { 
      ...options, 
      method: "POST", 
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: body ? JSON.stringify(body) : undefined 
    }),
  put: (url: string, body?: any, options?: RequestInit) => 
    apiFetch(url, { 
      ...options, 
      method: "PUT", 
      headers: { "Content-Type": "application/json", ...options?.headers },
      body: body ? JSON.stringify(body) : undefined 
    }),
  delete: (url: string, options?: RequestInit) => apiFetch(url, { ...options, method: "DELETE" }),
};
