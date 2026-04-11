import type { NextFunction, Request, Response } from "express";
import { jwtVerify } from "jose";
import { env } from "../config/env.js";
import { asyncHandler } from "../lib/async-handler.js";
import { extractApiCredential } from "../lib/bearer.js";
import { HttpError } from "../lib/http-error.js";
import { tryResolveTierFromSupabaseAccessToken } from "../lib/supabase-app.js";
import { parseTier, type Tier } from "../types/tier.js";

function isLikelyJwt(token: string): boolean {
  const parts = token.split(".");
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

function resolveLegacyTier(req: Request, apiKeyConfigured: boolean): Tier {
  const fromHeader = parseTier(req.header("x-subscription-tier"));
  if (fromHeader) return fromHeader;

  const q = req.query.tier;
  const fromQuery = typeof q === "string" ? parseTier(q) : null;
  if (fromQuery) return fromQuery;

  if (apiKeyConfigured) return "free";
  if (env.nodeEnv === "production") return "free";
  return "master";
}

/**
 * Auth (any of): Supabase session JWT (tier from DB), HS256 app JWT (`STOCKS_SERVER_JWT_SECRET`),
 * per-customer API keys (`STOCKS_SERVER_API_CLIENTS`), or legacy single key (`STOCKS_SERVER_API_KEY`).
 *
 * Legacy key still allows `X-Subscription-Tier` / `?tier=` for backwards compatibility.
 * Supabase users never need `X-Subscription-Tier` from the client — tier is loaded server-side.
 */
export const apiAuthAndTier = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const legacy = env.stocksServerApiKey;
  const clients = env.apiClients;
  const jwtSecret = env.stocksServerJwtSecret;
  const allowAnonymous = env.v1AllowAnonymousVisitor;

  const needAuth = Boolean(legacy || clients.length > 0 || jwtSecret);

  if (!needAuth) {
    req.subscriptionTier = env.nodeEnv === "production" ? "free" : "master";
    req.authSubject = undefined;
    req.hasFreeAccount = true;
    next();
    return;
  }

  const credential = extractApiCredential(req);

  if (!credential) {
    if (allowAnonymous) {
      req.subscriptionTier = "free";
      req.authSubject = undefined;
      req.hasFreeAccount = false;
      next();
      return;
    }
    throw new HttpError(401, "Invalid or missing credentials", { code: "unauthorized" });
  }

  const jwtOnly = Boolean(jwtSecret) && !legacy && clients.length === 0;

  const client = env.apiClientByKey.get(credential);
  if (client) {
    req.subscriptionTier = client.tier;
    req.authSubject = client.id;
    req.hasFreeAccount = true;
    next();
    return;
  }

  if (legacy && credential === legacy) {
    req.subscriptionTier = resolveLegacyTier(req, true);
    req.authSubject = "legacy";
    const v = req.header("x-visitor-preview");
    req.hasFreeAccount = !(typeof v === "string" && v.toLowerCase() === "true");
    next();
    return;
  }

  if (isLikelyJwt(credential)) {
    if (jwtSecret) {
      try {
        const key = new TextEncoder().encode(jwtSecret);
        const { payload } = await jwtVerify(credential, key, { algorithms: ["HS256"] });
        const sub = typeof payload.sub === "string" ? payload.sub : undefined;
        const tier = parseTier(typeof payload.tier === "string" ? payload.tier : "");
        if (tier) {
          req.subscriptionTier = tier;
          req.authSubject = sub ?? "jwt";
          req.hasFreeAccount = !("visitor" in payload && payload.visitor === true);
          next();
          return;
        }
      } catch {
        /* fall through: try Supabase or fail */
      }
    }

    const fromSupabase = await tryResolveTierFromSupabaseAccessToken(credential);
    if (fromSupabase) {
      req.subscriptionTier = fromSupabase.tier;
      req.authSubject = fromSupabase.userId;
      req.hasFreeAccount = true;
      next();
      return;
    }

    if (jwtOnly) {
      throw new HttpError(401, "Invalid or expired token", { code: "unauthorized" });
    }

    throw new HttpError(401, "Invalid or missing credentials", { code: "unauthorized" });
  }

  if (jwtOnly) {
    throw new HttpError(401, "Invalid or missing credentials", { code: "unauthorized" });
  }

  throw new HttpError(401, "Invalid or missing credentials", { code: "unauthorized" });
});
