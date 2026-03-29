"use client";

import Modal from "@/shared/components/molecules/Modal";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";

export interface SessionExpiredModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      setProgress(100);
      return;
    }

    // Démarrer le décompte
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleRedirect();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Animation de la barre de progression
    const progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev <= 0) {
          clearInterval(progressTimer);
          return 0;
        }
        return prev - (100 / 50); // 5 secondes = 50 intervalles de 100ms
      });
    }, 100);

    return () => {
      clearInterval(timer);
      clearInterval(progressTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleRedirect = () => {
    // Nettoyer les cookies et le storage
    if (typeof window !== "undefined") {
      document.cookie = "authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      localStorage.clear();
      sessionStorage.clear();
    }

    // Rediriger vers la page de connexion
    router.push("/se-connecter");

    if (onClose) {
      onClose();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleRedirect} size="md">
      <div className="relative flex flex-col bg-white rounded-2xl overflow-hidden">
        {/* Header avec icône */}
        <div className="px-8 pt-8 pb-6 text-center">
          <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-10 h-10 text-[#FF5C00]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </div>

          <h3 className="text-2xl font-bold text-gray-900 mb-3">
            Session expirée
          </h3>

          <p className="text-gray-600 text-base leading-relaxed max-w-sm mx-auto">
            Votre session a expiré pour des raisons de sécurité.
            Veuillez vous reconnecter pour continuer à utiliser l'application.
          </p>
        </div>

        {/* Barre de progression */}
        <div className="px-8 pb-6">
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF5C00] transition-all duration-100 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-gray-600 mt-3">
            Déconnexion automatique dans <span className="font-bold text-[#FF5C00]">{countdown} secondes</span>
          </p>
        </div>

        {/* Bouton d'action */}
        <div className="px-8 pb-8">
          <button
            onClick={handleRedirect}
            className="w-full px-6 py-3.5 text-base font-semibold text-white bg-[#FF5C00] rounded-xl hover:bg-[#E54F00] focus:outline-none focus:ring-2 focus:ring-[#FF5C00] focus:ring-offset-2 transition-all duration-200 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/30"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Se reconnecter maintenant
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default SessionExpiredModal;
