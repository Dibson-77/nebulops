"use client";

import React from "react";

export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
  nextPage: number | null;
  previousPage: number | null;
}

interface PaginationProps {
  meta: PaginationMeta | null;
  onPageChange: (page: number) => void;
  onLimitChange?: (limit: number) => void;
  t: any; // Theme tokens
}

export function Pagination({ 
  meta, 
  onPageChange, 
  onLimitChange, 
  t 
}: PaginationProps) {
  if (!meta) return null;

  const { totalPages, currentPage, totalItems, itemsPerPage } = meta;
  if (totalPages <= 1 && totalItems <= 10 && !onLimitChange) return null;

  const getPageNumbers = () => {
    const pages = [];
    const delta = 2; 
    
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== "...") {
        pages.push("...");
      }
    }
    return pages;
  };

  const btnBase: React.CSSProperties = {
    padding: "6px 12px", borderRadius: "8px", 
    borderWidth: "1px", borderStyle: "solid", borderColor: t.border,
    background: t.surfaceAlt,
    color: t.text, fontSize: "12px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s",
    display: "flex", alignItems: "center", justifyContent: "center", minWidth: "32px", height: "32px",
    outline: "none"
  };

  return (
    <div style={{ 
      display: "flex", justifyContent: "space-between", alignItems: "center", 
      marginTop: "24px", padding: "16px", borderRadius: "12px", 
      background: t.surfaceAlt + "44", border: `1px solid ${t.border}`
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ fontSize: "13px", color: t.textMuted }}>
          Page <b>{currentPage}</b> sur <b>{totalPages}</b>
        </div>
        {onLimitChange && (
          <select 
            value={itemsPerPage}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            style={{ 
              background: t.surface, border: `1px solid ${t.borderMid}`, borderRadius: "8px",
              padding: "4px 8px", fontSize: "12px", color: t.text, cursor: "pointer", outline: "none"
            }}
          >
            {[5, 10, 25, 50, 100].map(val => (
              <option key={val} value={val}>{val} par page</option>
            ))}
          </select>
        )}
      </div>

      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <button
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          style={{ ...btnBase, background: t.surface, opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
        >
          Précédent
        </button>

        {getPageNumbers().map((p, idx) => (
          p === "..." ? (
            <span key={`dots-${idx}`} style={{ padding: "0 4px", color: t.textFaint }}>...</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(Number(p))}
              style={{ 
                ...btnBase, 
                background: p === currentPage ? "#5b8def" : t.surface, 
                color: p === currentPage ? "#fff" : t.text,
                borderColor: p === currentPage ? "#5b8def" : t.border,
              }}
            >
              {p}
            </button>
          )
        ))}

        <button
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          style={{ ...btnBase, background: t.surface, opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
