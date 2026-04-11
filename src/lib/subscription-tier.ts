import type { Tier } from "../types/tier.js";

/** DB row shape from `user_subscriptions` (subset). */
export type SubscriptionRow = {
  status?: string;
  plan_id?: string | null;
} | null;

/**
 * Maps billing plan + status to API tier. Inactive or unknown plans → free.
 * Aligns with SPA legacy plan ids (pro/premium).
 */
export function subscriptionRowToTier(sub: SubscriptionRow): Tier {
  if (!sub || sub.status !== "active") return "free";
  const p = String(sub.plan_id ?? "").toLowerCase();
  if (p === "master" || p === "premium") return "master";
  if (p === "beginner" || p === "pro") return "beginner";
  if (p === "free") return "free";
  return "free";
}

export function entitlementsFromSubscription(sub: SubscriptionRow): {
  tier: Tier;
  isPro: boolean;
  isPremium: boolean;
} {
  const tier = subscriptionRowToTier(sub);
  const active = sub?.status === "active";
  const paid = tier === "beginner" || tier === "master";
  return {
    tier,
    isPro: active && paid,
    isPremium: active && tier === "master",
  };
}
