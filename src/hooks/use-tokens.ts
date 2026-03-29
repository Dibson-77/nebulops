import type { ThemeTokens } from "@/types";

export function useTokens(dark: boolean): ThemeTokens {
  return {
    bg:         dark ? "#0f1117" : "#f4f6f9",
    surface:    dark ? "#16181e" : "#ffffff",
    surfaceAlt: dark ? "#1c1e26" : "#f0f2f5",
    sidebar:    dark ? "#121318" : "#ffffff",
    border:     dark ? "#2a2d38" : "#e1e4eb",
    borderMid:  dark ? "#33363f" : "#cdd1da",
    text:       dark ? "#e4e5ea" : "#1e2028",
    textMuted:  dark ? "#8b8d98" : "#6b6f7e",
    textFaint:  dark ? "#4e515e" : "#9ea2b0",
    topbar:     dark ? "rgba(15,17,23,0.95)" : "rgba(255,255,255,0.95)",
    diskBg:     dark ? "#23252e" : "#e6e9ef",
    hover:      dark ? "#1f2129" : "#eaecf2",
    accentText: dark ? "#e4e5ea" : "#1e2028",
    chartGrid:  dark ? "#23252e" : "#e6e9ef",
    chartText:  dark ? "#8b8d98" : "#6b6f7e",
  };
}
