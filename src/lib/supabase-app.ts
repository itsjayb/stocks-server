import type { Request } from "express";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Tier } from "../types/tier.js";
import { env } from "../config/env.js";
import { extractBearer } from "./bearer.js";
import { HttpError } from "./http-error.js";
import { subscriptionRowToTier, type SubscriptionRow } from "./subscription-tier.js";

function requireSupabase(): { url: string; anonKey: string } {
  const url = env.supabaseUrl;
  const anonKey = env.supabaseAnonKey;
  if (!url || !anonKey) {
    throw new HttpError(503, "SUPABASE_URL and SUPABASE_ANON_KEY must be set on the server", {
      code: "supabase_unconfigured",
    });
  }
  return { url, anonKey };
}

/** Server-side anon client (no user session). */
export function createAnonSupabase(): SupabaseClient {
  const { url, anonKey } = requireSupabase();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** User-scoped client (RLS applies). */
export function createUserSupabase(accessToken: string): SupabaseClient {
  const { url, anonKey } = requireSupabase();
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });
}

/** Validates `Authorization: Bearer` and returns the Supabase user + client. */
export async function requireSupabaseUser(req: Request): Promise<{ user: User; supabase: SupabaseClient }> {
  const token = extractBearer(req);
  if (!token) {
    throw new HttpError(401, "Missing Authorization header", { code: "unauthorized" });
  }
  const supabase = createUserSupabase(token);
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser(token);
  if (userErr || !user) {
    throw new HttpError(401, "Invalid or expired session", { code: "unauthorized" });
  }
  return { user, supabase };
}

/**
 * Validates a Supabase user access token and resolves `/v1` tier from `user_subscriptions` (server-side; do not trust client tier headers).
 */
export async function tryResolveTierFromSupabaseAccessToken(accessToken: string): Promise<{
  tier: Tier;
  userId: string;
} | null> {
  if (!env.supabaseUrl || !env.supabaseAnonKey) return null;
  try {
    const supabase = createUserSupabase(accessToken);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);
    if (error || !user) return null;
    const { data: row, error: subErr } = await supabase
      .from("user_subscriptions")
      .select("status, plan_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (subErr) return null;
    const tier = subscriptionRowToTier(row as SubscriptionRow);
    return { tier, userId: user.id };
  } catch {
    return null;
  }
}
