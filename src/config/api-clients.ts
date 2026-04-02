import { parseTier, type Tier } from "../types/tier.js";

export type ApiClientRecord = { id: string; key: string; tier: Tier };

/**
 * Parse `STOCKS_SERVER_API_CLIENTS` JSON array. Each row: `{ "id", "key", "tier" }`.
 * Tier is enforced server-side (not from `X-Subscription-Tier`).
 */
export function parseApiClientsFromJson(raw: string | undefined): ApiClientRecord[] {
  if (!raw?.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error("STOCKS_SERVER_API_CLIENTS is not valid JSON");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("STOCKS_SERVER_API_CLIENTS must be a JSON array");
  }
  const out: ApiClientRecord[] = [];
  const keysSeen = new Set<string>();
  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object") {
      throw new Error(`STOCKS_SERVER_API_CLIENTS[${i}] must be an object`);
    }
    const o = row as Record<string, unknown>;
    const id = o.id;
    const key = o.key;
    const tierRaw = o.tier;
    if (typeof id !== "string" || !id.trim()) {
      throw new Error(`STOCKS_SERVER_API_CLIENTS[${i}]: missing or invalid id`);
    }
    if (typeof key !== "string" || !key.trim()) {
      throw new Error(`STOCKS_SERVER_API_CLIENTS[${i}] (${id}): missing or invalid key`);
    }
    const tier = parseTier(typeof tierRaw === "string" ? tierRaw : "");
    if (!tier) {
      throw new Error(`STOCKS_SERVER_API_CLIENTS[${i}] (${id}): tier must be free | beginner | master`);
    }
    const k = key.trim();
    if (keysSeen.has(k)) {
      throw new Error("STOCKS_SERVER_API_CLIENTS: duplicate key");
    }
    keysSeen.add(k);
    out.push({ id: id.trim(), key: k, tier });
  }
  return out;
}

export function apiClientLookupMap(clients: readonly ApiClientRecord[]): Map<string, ApiClientRecord> {
  return new Map(clients.map((c) => [c.key, c]));
}
