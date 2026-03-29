"use client";

import React, { useEffect, useState } from "react";
import { useAppStore } from "@/store/use-app-store";
import { useTokens } from "@/hooks/use-tokens";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export function Toast() {
  const { toast, dark } = useAppStore();
  const t = useTokens(dark);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (toast) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [toast, setVisible]);

  if (!toast && !visible) return null;

  const isSuccess = toast?.type === "success";

  return (
    <div style={{
      position: "fixed",
      top: "24px",
      right: "24px",
      zIndex: 9999,
      pointerEvents: "none",
    }}>
      <div style={{
        minWidth: "300px",
        padding: "16px 20px",
        borderRadius: "16px",
        background: isSuccess ? (dark ? "rgba(77, 171, 138, 0.12)" : "rgba(220, 243, 234, 0.95)") : (dark ? "rgba(217, 85, 101, 0.12)" : "rgba(248, 230, 233, 0.95)"),
        backdropFilter: "blur(12px)",
        border: `1px solid ${isSuccess ? "rgba(77, 171, 138, 0.3)" : "rgba(217, 85, 101, 0.3)"}`,
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        display: "flex",
        alignItems: "center",
        gap: "14px",
        transform: visible ? "translateX(0) scale(1)" : "translateX(100%) scale(0.9)",
        opacity: visible ? 1 : 0,
        transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        pointerEvents: "auto",
      }}>
        <div style={{
          width: "32px",
          height: "32px",
          borderRadius: "10px",
          background: isSuccess ? "rgba(77, 171, 138, 0.2)" : "rgba(217, 85, 101, 0.2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: isSuccess ? "#4dab8a" : "#d95565",
        }}>
          {isSuccess ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
        </div>
        
        <div style={{ flex: 1 }}>
          <div style={{ 
            fontSize: "14px", 
            fontWeight: 700, 
            color: isSuccess ? "#2d7a5e" : "#a8404f",
            marginBottom: "2px"
          }}>
            {isSuccess ? "Succès" : "Attention"}
          </div>
          <div style={{ 
            fontSize: "13px", 
            color: isSuccess ? "#3d8f6e" : "#b84858",
            opacity: 0.9
          }}>
            {toast?.message}
          </div>
        </div>
      </div>
    </div>
  );
}
