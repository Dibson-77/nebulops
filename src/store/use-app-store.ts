import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Server, Tab, AdminSection } from "@/types";
import { apiFetch } from "@/lib/api-client";

interface AppState {
  // Theme (Default to Light: false)
  dark: boolean;
  setDark: (dark: boolean) => void;

  // Data
  servers: Server[];
  setServers: (servers: Server[]) => void;
  updateServer: (id: number, updates: Partial<Server>) => void;
  fetchServers: () => Promise<void>;

  // Navigation / UI State
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  adminSection: AdminSection;
  setAdminSection: (section: AdminSection) => void;

  // Search / Filters
  search: string;
  setSearch: (search: string) => void;
  filterEnv: string;
  setFilterEnv: (env: string) => void;
  filterProv: string;
  setFilterProv: (prov: string) => void;

  // UI : Toasts
  toast: { message: string; type: "success" | "error" } | null;
  showToast: (message: string, type?: "success" | "error") => void;

  // New: Initial Loading state
  isInitialLoading: boolean;

  // New: Session state
  sessionExpired: boolean;
  setSessionExpired: (expired: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Theme: Initialized to false (Light mode)
      dark: false,
      setDark: (dark) => set({ dark }),

      // Data
      servers: [],
      isInitialLoading: true,
      setServers: (servers) => set({ servers, isInitialLoading: false }),
      updateServer: (id, updates) =>
        set((state) => ({
          servers: state.servers.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        })),
      fetchServers: async () => {
        try {
          // On demande TOUS les serveurs pour les stats de la sidebar/dashboard
          const res = await apiFetch("/api/servers?all=true");
          if (res.ok) {
            const json = await res.json();
            const data = json.data || json; // Supporte l'ancien et le nouveau format
            set({ servers: data, isInitialLoading: false });
          } else {
            set({ isInitialLoading: false });
          }
        } catch (e) {
          console.error("Failed to fetch servers", e);
          set({ isInitialLoading: false });
        }
      },

      // Navigation
      activeTab: "dashboard",
      setActiveTab: (tab) => set({ activeTab: tab }),
      adminSection: "users",
      setAdminSection: (section) => set({ adminSection: section }),

      // Filters
      search: "",
      setSearch: (search) => set({ search }),
      filterEnv: "all",
      setFilterEnv: (env) => set({ filterEnv: env }),
      filterProv: "all",
      setFilterProv: (prov) => set({ filterProv: prov }),

      // UI : Toasts
      toast: null,
      showToast: (message, type = "success") => {
        set({ toast: { message, type } });
        setTimeout(() => {
          set((state) => (state.toast?.message === message ? { toast: null } : {}));
        }, 4000);
      },

      // Session
      sessionExpired: false,
      setSessionExpired: (sessionExpired) => set({ sessionExpired }),
    }),
    {
      name: "nebulops-storage", // Key in localStorage
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ dark: state.dark }), // Only persist theme
    }
  )
);
