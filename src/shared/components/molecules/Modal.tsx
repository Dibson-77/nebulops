"use client";

import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useAppStore } from "@/store/use-app-store";
import { useTokens } from "@/hooks/use-tokens";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const SIZES = {
  sm: "380px",
  md: "500px",
  lg: "700px",
  xl: "900px",
  full: "95vw",
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
}) => {
  const { dark } = useAppStore();
  const t = useTokens(dark);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEsc);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(4px)",
        animation: "fade-in 0.2s ease-out",
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scale-up { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div
        ref={modalRef}
        style={{
          width: "100%",
          maxWidth: SIZES[size],
          background: t.surface,
          border: `1px solid ${t.borderMid}`,
          borderRadius: "20px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          overflow: "hidden",
          animation: "scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            style={{
              padding: "20px 24px",
              borderBottom: `1px solid ${t.border}`,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ fontSize: "18px", fontWeight: 800, color: t.text }}>
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: t.textMuted,
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "8px",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceAlt)}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              <X size={20} />
            </button>
          </div>
        )}
        <div style={{ maxHeight: "85vh", overflowY: "auto" }}>{children}</div>
      </div>
    </div>
  );
};

export default Modal;
