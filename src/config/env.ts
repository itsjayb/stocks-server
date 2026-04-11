import {
  apiClientLookupMap,
  parseApiClientsFromJson,
  type ApiClientRecord,
} from "./api-clients.js";

function optional(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

function required(name: string): string {
  const v = optional(name);
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const apiClients: ApiClientRecord[] = parseApiClientsFromJson(optional("STOCKS_SERVER_API_CLIENTS"));

export const env = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV ?? "development",

  /** If set, all `/v1/*` routes require this key (header or Bearer). Tier may still come from `X-Subscription-Tier` (legacy). Prefer `STOCKS_SERVER_API_CLIENTS` for paid tiers. */
  stocksServerApiKey: optional("STOCKS_SERVER_API_KEY"),

  /**
   * JSON array of `{ "id": "customer_1", "key": "sk_...", "tier": "beginner" }`.
   * When non-empty, those keys are accepted and tier is taken from the record (not from client headers).
   */
  apiClients,
  apiClientByKey: apiClientLookupMap(apiClients),

  /** HS256 secret for `Authorization: Bearer <jwt>`. Claims: `sub`, `tier` (free|beginner|master), `exp`; optional `visitor: true` for anonymous preview (subset of Free tier). */
  stocksServerJwtSecret: optional("STOCKS_SERVER_JWT_SECRET"),

  /**
   * When `/v1/*` requires credentials (API key / JWT mode), allow requests with no `X-Api-Key` or `Authorization`
   * to proceed as anonymous visitors (`subscriptionTier: free`, `hasFreeAccount: false`).
   * Set to `false` to require a key or token for every `/v1` call (stricter).
   * Default: true (browsers call `/v1` with only a Supabase session when logged in; logged-out users stay anonymous).
   */
  v1AllowAnonymousVisitor: optional("STOCKS_SERVER_V1_ANONYMOUS_VISITOR") !== "false",

  /** Comma-separated origins for `Access-Control-Allow-Origin`. Empty = no CORS middleware. */
  corsOrigins: (optional("STOCKS_SERVER_CORS_ORIGINS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  alpacaDataBaseUrl:
    optional("ALPACA_DATA_BASE_URL") ?? "https://data.alpaca.markets",
  alpacaApiKeyId: optional("ALPACA_API_KEY_ID"),
  alpacaApiSecretKey: optional("ALPACA_API_SECRET_KEY"),

  finnhubApiKey: optional("FINNHUB_API_KEY"),
  alphaVantageApiKey: optional("ALPHA_VANTAGE_API_KEY"),

  /** Optional macro series (FRED). */
  fredApiKey: optional("FRED_API_KEY"),

  /** Supabase (app auth, user profile, billing, social) — same project as the web app. */
  supabaseUrl: optional("SUPABASE_URL"),
  supabaseAnonKey: optional("SUPABASE_ANON_KEY"),

  /** Stripe secret for `/billing/*` (never expose to browsers). */
  stripeSecretKey: optional("STRIPE_SECRET_KEY"),

  /** Set `true` when behind a reverse proxy so rate limits and logs use real client IPs. */
  trustProxy: optional("TRUST_PROXY") === "true",
};

export function requireFinnhub(): string {
  return required("FINNHUB_API_KEY");
}

export function requireAlphaVantage(): string {
  return required("ALPHA_VANTAGE_API_KEY");
}

export function alpacaConfigured(): boolean {
  return Boolean(env.alpacaApiKeyId && env.alpacaApiSecretKey);
}

export function finnhubConfigured(): boolean {
  return Boolean(env.finnhubApiKey);
}
