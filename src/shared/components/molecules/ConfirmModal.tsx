"use client";

import React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Modal } from "./Modal";
import { useAppStore } from "@/store/use-app-store";
import { useTokens } from "@/hooks/use-tokens";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirmer",
  cancelText = "Annuler",
  variant = "danger",
  isLoading = false,
}) => {
  const { dark } = useAppStore();
  const t = useTokens(dark);

  const colors = {
    danger: {
      bg: "#f8e0e3",
      icon: "#d95565",
      btn: "#d95565",
      btnHover: "#c14455",
    },
    warning: {
      bg: "#f5ecd4",
      icon: "#d4a843",
      btn: "#d4a843",
      btnHover: "#b89235",
    },
    info: {
      bg: "#dfe6f8",
      icon: "#5b8def",
      btn: "#5b8def",
      btnHover: "#4a7ad9",
    },
  };

  const activeColor = colors[variant];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <div style={{ padding: "32px", textAlign: "center" }}>
        <div
          style={{
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: dark ? `${activeColor.icon}22` : activeColor.bg,
            color: activeColor.icon,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 24px",
          }}
        >
          {variant === "danger" ? <Trash2 size={32} /> : <AlertTriangle size={32} />}
        </div>

        <h3
          style={{
            fontSize: "20px",
            fontWeight: 800,
            color: t.text,
            marginBottom: "12px",
          }}
        >
          {title}
        </h3>

        <div
          style={{
            fontSize: "14px",
            color: t.textMuted,
            lineHeight: 1.6,
            marginBottom: "32px",
          }}
        >
          {message}
        </div>

        <div style={{ display: "flex", gap: "12px" }}>
          <button
            onClick={onClose}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "12px",
              border: `1px solid ${t.borderMid}`,
              background: "none",
              color: t.text,
              fontSize: "14px",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = t.surfaceAlt)}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: "12px",
              borderRadius: "12px",
              border: "none",
              background: activeColor.btn,
              color: "#fff",
              fontSize: "14px",
              fontWeight: 700,
              cursor: isLoading ? "not-allowed" : "pointer",
              boxShadow: `0 4px 14px ${activeColor.btn}44`,
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = activeColor.btnHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = activeColor.btn)}
          >
            {isLoading ? "..." : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ConfirmModal;
