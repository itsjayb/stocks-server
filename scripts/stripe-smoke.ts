/**
 * Verifies STRIPE_SECRET_KEY can create a PaymentIntent (Stripe test or live mode).
 * Uses $0.50 USD in test mode — no real charges when using sk_test_...
 *
 * Usage: STRIPE_SECRET_KEY=sk_test_... npx tsx scripts/stripe-smoke.ts
 */
import "dotenv/config";
import { env } from "../src/config/env.js";

async function main(): Promise<void> {
  const key = env.stripeSecretKey;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set or not a valid secret key (sk_...).");
    process.exit(1);
  }

  const res = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      amount: "50",
      currency: "usd",
      description: "stocks-server stripe-smoke (safe to delete in Stripe Dashboard)",
    }).toString(),
  });

  const data = (await res.json()) as { id?: string; error?: { message?: string } };

  if (!res.ok) {
    console.error("Stripe API error:", data.error?.message ?? data);
    process.exit(1);
  }

  console.log(`OK: PaymentIntent ${data.id} created. In test mode you can cancel it from the Dashboard if you like.`);
}

void main();
