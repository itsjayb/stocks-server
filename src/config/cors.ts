import { env } from "./env.js";

/** Vite default dev server — merged with `STOCKS_SERVER_CORS_ORIGINS`. */
const DEV_VITE_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

/**
 * Allowed browser `Origin` values. Combines `STOCKS_SERVER_CORS_ORIGINS` with Vite dev URLs (deduped).
 * Production deployments should still set `STOCKS_SERVER_CORS_ORIGINS` to the real site origin(s).
 */
export function getEffectiveCorsOrigins(): string[] {
  return [...new Set([...env.corsOrigins, ...DEV_VITE_ORIGINS])];
}

/**
 * Whether a browser Origin may receive CORS headers. Non-browser requests (`Origin` missing) are allowed.
 * In non-production, any http(s) origin on localhost / 127.0.0.1 is allowed so alternate Vite ports and LAN dev work.
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true;
  const list = getEffectiveCorsOrigins();
  if (list.includes(origin)) return true;
  if (env.nodeEnv === "production") return false;
  try {
    const u = new URL(origin);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}
