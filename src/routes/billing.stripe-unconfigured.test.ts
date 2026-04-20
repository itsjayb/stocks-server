import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { billingRouter } from "./billing.js";
import { errorHandler } from "../lib/async-handler.js";

const mockRequireSupabaseUser = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    user: { id: "user-1" },
    supabase: {},
  }),
);

vi.mock("../config/env.js", () => ({
  env: { stripeSecretKey: undefined },
}));

vi.mock("../lib/supabase-app.js", () => ({
  requireSupabaseUser: mockRequireSupabaseUser,
}));

function createTestApp() {
  const app = express();
  app.use(express.json({ limit: "256kb" }));
  app.use("/billing", billingRouter);
  app.use(errorHandler);
  return app;
}

describe("billing without Stripe secret", () => {
  it("POST /create-payment-intent returns 503", async () => {
    const res = await request(createTestApp())
      .post("/billing/create-payment-intent")
      .set("Authorization", "Bearer fake-token")
      .send({
        amount: 999,
        currency: "usd",
        userId: "user-1",
        tier: "beginner",
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("stripe_unconfigured");
  });
});
