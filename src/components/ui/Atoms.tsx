/**
 * components/ui/StatusDot.tsx
 */
import { STATUS_COLORS } from "@/lib/constants";
import type { MetricStatus } from "@/types";

export function StatusDot({ status }: { status: MetricStatus }) {
  const color = STATUS_COLORS[status] || "#8891a0";
  return (
    <div
      style={{
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        backgroundColor: color,
        boxShadow: `0 0 8px ${color}80`,
      }}
    />
  );
}

/**
 * components/ui/EnvPill.tsx
 */
import { ENV_COLORS } from "@/lib/constants";
import type { Environment } from "@/types";

export function EnvPill({ env }: { env: Environment }) {
  const color = ENV_COLORS[env] || "#8891a0";
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        padding: "2px 8px",
        borderRadius: "4px",
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
        textTransform: "uppercase",
        letterSpacing: "0.02em",
      }}
    >
      {env}
    </span>
  );
}

/**
 * components/ui/ProviderBadge.tsx
 */
import { PROVIDER_COLORS } from "@/lib/constants";
import type { Provider } from "@/types";

export function ProviderBadge({ provider }: { provider: Provider }) {
  const color = PROVIDER_COLORS[provider] || "#8891a0";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <div
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      <span style={{ fontSize: "12px", fontWeight: 500 }}>{provider}</span>
    </div>
  );
}
