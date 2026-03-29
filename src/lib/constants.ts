import type { Provider, Environment, Role, MetricStatus, Profile } from "@/types";

// ─── Palettes ────────────────────────────────────────────────────────────────

export const PROVIDER_COLORS: Record<Provider, string> = {
  OVH:   "#5b8def",
  Azure: "#4ba3d9",
  AWS:   "#e08a4a",
};

export const ENV_COLORS: Record<Environment, string> = {
  Dev:    "#5bb8cf",
  Demo:   "#9585d3",
  Pilote: "#d4a843",
  Prod:   "#4dab8a",
  Backup: "#8891a0",
};

export const ROLE_COLORS: Record<Role, string> = {
  admin:    "#d95565",
  operator: "#d4a843",
  viewer:   "#7b84c9",
};

export const STATUS_COLORS: Record<MetricStatus, string> = {
  online:   "#4dab8a",
  offline:  "#d95565",
  degraded: "#d4a843",
  unknown:  "#8891a0",
};

// ─── Constantes globales ─────────────────────────────────────────────────────

export const ENV_ORDER: Environment[] = ["Dev", "Demo", "Pilote", "Prod", "Backup"];
export const DISK_ALERT_PCT = 80;

// ─── Profils (définition des rôles) ──────────────────────────────────────────

export const PROFILES: Profile[] = [
  {
    id: 1, libelle: "admin", label: "Administrateur", color: "#d95565",
    description: "Accès complet.",
    permissions: ["Gestion serveurs", "Gestion utilisateurs", "Configuration système", "Suppression données", "Journal d'audit", "Paramètres"],
  },
  {
    id: 2, libelle: "operator", label: "Opérateur", color: "#d4a843",
    description: "Gère les serveurs.",
    permissions: ["Gestion serveurs", "Consultation alertes", "Dashboard", "Export données"],
  },
  {
    id: 3, libelle: "viewer", label: "Observateur", color: "#7b84c9",
    description: "Lecture seule.",
    permissions: ["Dashboard", "Alertes (lecture)", "Serveurs (lecture)"],
  },
];
