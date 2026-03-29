import { createHash } from "crypto";

/**
 * Normalise un message de log pour ignorer les données variables
 * (timestamps, IDs, IPs, chemins absolus, nombres).
 * Permet de regrouper "Error on line 42" et "Error on line 87" ensemble.
 */
function normalizeMessage(msg: string): string {
  return msg
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?/g, "{TIMESTAMP}")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "{UUID}")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "{IP}")
    .replace(/\/[a-zA-Z0-9_\-./]+\.(js|ts|py|php|rb|go|java|log)/g, "{PATH}")
    .replace(/\b0x[0-9a-fA-F]+\b/g, "{HEX}")
    .replace(/req_[a-zA-Z0-9]+/g, "{REQ_ID}")
    .replace(/\b\d+\b/g, "{N}");
}

/**
 * Calcule un fingerprint déterministe SHA-256 pour un log.
 * Même erreur = même fingerprint, peu importe les données variables.
 */
export function computeFingerprint(params: {
  serverId: number;
  source: string;
  message: string;
  containerName?: string | null;
}): string {
  const normalized = normalizeMessage(params.message);
  const key = `${params.serverId}|${params.source}|${params.containerName ?? ""}|${normalized}`;
  return createHash("sha256").update(key).digest("hex");
}
