// ─── Domain Types ─────────────────────────────────────────────────────────────

export type Provider = "OVH" | "Azure" | "AWS";
export type Environment = "Dev" | "Demo" | "Pilote" | "Prod" | "Backup";
export type Role = "admin" | "operator" | "viewer";
export type Tab = "dashboard" | "servers" | "alerts" | "admin" | "logs";
export type AdminSection = "users" | "profiles" | "infrastructure" | "logs" | "whatsapp";
export type LogLevel = "WARN" | "ERROR" | "FATAL";
export type LogSource = "DOCKER" | "SYSTEM" | "WEBHOOK";
export type MetricStatus = "online" | "offline" | "degraded" | "unknown";

// ─── Server & Metrics ────────────────────────────────────────────────────────

export interface ServerMetrics {
  diskTotalGb: number;
  diskUsedGb: number;
  diskFreeGb: number;
  diskUsedPct: number;
  ramTotalGb: number;
  ramUsedGb: number;
  ramFreePct: number;
  ramUsedPct?: number; 
  cpuLoadPct: number;
  uptimeHours: number;
  services: { name: string; status: "running" | "stopped" }[];
  lastPolledAt: string;
  status: MetricStatus;
}

export interface Project {
  id: number;
  name: string;
  serverId: number;
  createdAt: string;
}

export interface Server {
  id: number;
  ip: string;
  name: string;
  environment: Environment;
  provider: Provider;
  agentPort: number;
  agentActive: boolean;
  agentToken?: string;
  description: string;
  statusLastChangedAt: string;
  metrics: ServerMetrics | null;
  projects: Project[];
}

// ─── User & Profile ──────────────────────────────────────────────────────────

export interface User {
  id: number;
  firstname?: string;
  lastname?: string;
  phoneNumber?: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLogin: string;
  avatar: string;
}

export interface Profile {
  id: number;
  libelle: string;
  label: string;
  color: string;
  description: string;
  permissions: string[];
}

// ─── Theme Tokens ────────────────────────────────────────────────────────────

export interface ThemeTokens {
  bg: string;
  surface: string;
  surfaceAlt: string;
  sidebar: string;
  border: string;
  borderMid: string;
  text: string;
  textMuted: string;
  textFaint: string;
  topbar: string;
  diskBg: string;
  hover: string;
  accentText: string;
  chartGrid: string;
  chartText: string;
}
// ─── Logs ────────────────────────────────────────────────────────────────────

export interface ServerLog {
  id: number;
  serverId: number;
  server?: { id: number; name: string; ip: string; environment: string };
  source: LogSource;
  level: LogLevel;
  message: string;
  stackTrace: string | null;
  containerName: string | null;
  serviceName: string | null;
  fingerprint: string;
  occurrences: number;
  isResolved: boolean;
  resolvedAt: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface LogStats {
  total: number;
  unresolved: number;
  byLevel: Record<LogLevel, number>;
  bySource: Record<LogSource, number>;
}

// ─── AlertSettings ───────────────────────────────────────────────────────────

export interface AlertSettings {
  id: number;
  whatsappEnabled: boolean;
  whatsappTo: string;    // Numéro destinataire: +2250769617143
  diskThreshold: number;
  cpuThreshold: number;
  ramThreshold: number;
  cooldownMinutes: number;
  updatedAt: string;
}

export type WAState = "disconnected" | "initializing" | "qr_pending" | "authenticated" | "ready" | "error";

export interface WAStatus {
  state:   WAState;
  qrCode?: string;  // base64 PNG — présent quand state === "qr_pending"
  phone?:  string;  // numéro bot connecté — présent quand state === "ready"
  error?:  string;
}

// ─── Pagination ─────────────────────────────────────────────────────────────

export interface IPaginationParams {
  page?: string | number;
  limit?: string | number;
  search?: string;
  searchWord?: string;
  all?: boolean;
}

export interface IPaginationResult<T> {
  data: T[];
  metadata: {
    currentPage: number;
    previousPage: number | null;
    nextPage: number | null;
    itemsPerPage: number;
    totalItems: number;
    totalPages: number;
  };
}
