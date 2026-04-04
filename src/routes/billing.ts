import { Router } from "express";
import { env } from "../config/env.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { requireSupabaseUser } from "../lib/supabase-app.js";

export const billingRouter = Router();

/** Must match SPA `stocksforbeginner/src/lib/tiers.ts` `priceCents` for paid tiers. */
const TIER_PRICE_CENTS: Record<"beginner" | "master", number> = {
  beginner: 999,
  master: 1999,
};

interface PaymentIntentBody {
  amount: number;
  currency: string;
  userId: string;
  tier?: "beginner" | "master";
}

billingRouter.post(
  "/create-payment-intent",
  asyncHandler(async (req, res) => {
    const stripeSecretKey = env.stripeSecretKey;
    if (!stripeSecretKey) {
      throw new HttpError(503, "Stripe is not configured on this server", { code: "stripe_unconfigured" });
    }

    const { user, supabase } = await requireSupabaseUser(req);

    const body = req.body as PaymentIntentBody;
    const { amount, currency, userId, tier } = body ?? {};
    if (typeof amount !== "number" || !currency || typeof userId !== "string") {
      throw new HttpError(400, "amount, currency, and userId are required", { code: "invalid_body" });
    }
    if (userId !== user.id) {
      throw new HttpError(403, "userId does not match authenticated user", { code: "forbidden" });
    }

    if (tier === "beginner" || tier === "master") {
      if (amount !== TIER_PRICE_CENTS[tier]) {
        throw new HttpError(400, "amount does not match selected tier", { code: "invalid_amount" });
      }
    } else if (tier !== undefined) {
      throw new HttpError(400, "tier must be beginner or master", { code: "invalid_body" });
    }

    const paymentIntentResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: amount.toString(),
        currency,
        "metadata[userId]": userId,
        ...(tier ? { "metadata[tier]": tier } : {}),
      }).toString(),
    });

    if (!paymentIntentResponse.ok) {
      const errorData = (await paymentIntentResponse.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new HttpError(400, errorData.error?.message ?? "Stripe error", { code: "stripe_error" });
    }

    const paymentIntent = (await paymentIntentResponse.json()) as { client_secret?: string };
    res.json({ clientSecret: paymentIntent.client_secret });
  }),
);

interface ActivateBody {
  userId: string;
  tier: "beginner" | "master";
}

/** Stored subscription amount (USD); must match SPA tier `price` in `tiers.ts`. */
const TIER_AMOUNT_PAID_USD: Record<"beginner" | "master", number> = {
  beginner: 9.99,
  master: 19.99,
};

billingRouter.post(
  "/activate-subscription",
  asyncHandler(async (req, res) => {
    const { user, supabase } = await requireSupabaseUser(req);

    const body = req.body as ActivateBody;
    const { userId, tier } = body ?? {};
    if (typeof userId !== "string" || !tier) {
      throw new HttpError(400, "userId and tier are required", { code: "invalid_body" });
    }
    if (userId !== user.id) {
      throw new HttpError(403, "userId does not match authenticated user", { code: "forbidden" });
    }
    if (tier !== "beginner" && tier !== "master") {
      throw new HttpError(400, "tier must be beginner or master", { code: "invalid_body" });
    }

    const amount = TIER_AMOUNT_PAID_USD[tier];
    const now = new Date().toISOString();

    const { error } = await supabase.from("user_subscriptions").upsert(
      {
        user_id: userId,
        status: "active",
        plan_id: tier,
        amount_paid: amount,
        currency: "USD",
        updated_at: now,
        current_period_start: now,
        current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      { onConflict: "user_id" },
    );

    if (error) {
      throw new HttpError(500, error.message, { code: "db_error" });
    }

    res.json({ success: true, tier });
  }),
);
