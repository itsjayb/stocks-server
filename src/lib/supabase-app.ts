import type { Request } from "express";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { env } from "../config/env.js";
import { extractBearer } from "./bearer.js";
import { HttpError } from "./http-error.js";

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
