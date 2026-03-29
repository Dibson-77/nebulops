"use client";

import { useEffect, useRef, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3006";
const RECONNECT_DELAY = 3000;

/**
 * useWebSocket — Hook de connexion WebSocket temps réel.
 * Appelle `onMessage` à chaque message reçu du serveur WS.
 * Se reconnecte automatiquement en cas de déconnexion.
 */
export function useWebSocket(onMessage: (data: any) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    // Éviter les connexions multiples
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[WS] ✅ Connecté au serveur temps réel");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageRef.current(data);
        } catch (e) {
          console.warn("[WS] Message non-JSON reçu:", event.data);
        }
      };

      ws.onclose = () => {
        console.log("[WS] 🔄 Déconnecté, reconnexion dans 3s...");
        wsRef.current = null;
        timerRef.current = setTimeout(connect, RECONNECT_DELAY);
      };

      ws.onerror = () => {
        // onclose will fire after this
        ws.close();
      };
    } catch (e) {
      console.error("[WS] Erreur de connexion:", e);
      timerRef.current = setTimeout(connect, RECONNECT_DELAY);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // Empêcher la reconnexion au démontage
        wsRef.current.close();
      }
    };
  }, [connect]);
}
