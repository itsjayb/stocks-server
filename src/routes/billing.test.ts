import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { billingRouter } from "./billing.js";
import { errorHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";

const mockRequireSupabaseUser = vi.hoisted(() => vi.fn());

vi.mock("../config/env.js", () => ({
  env: { stripeSecretKey: "sk_test_vitest" },
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

describe("billing routes", () => {
  let mockFetch: Mock;
  let mockUpsert: Mock;

  beforeEach(() => {
    mockUpsert = vi.fn().mockResolvedValue({ error: null });
    mockRequireSupabaseUser.mockResolvedValue({
      user: { id: "user-1" },
      supabase: {
        from: vi.fn().mockReturnValue({ upsert: mockUpsert }),
      },
    });
    mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ client_secret: "pi_test_secret" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("POST /create-payment-intent returns clientSecret and forwards tier metadata to Stripe", async () => {
    const res = await request(createTestApp())
      .post("/billing/create-payment-intent")
      .set("Authorization", "Bearer fake-token")
      .send({
        amount: 999,
        currency: "usd",
        userId: "user-1",
        tier: "beginner",
      });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ clientSecret: "pi_test_secret" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.stripe.com/v1/payment_intents");
    expect(init.method).toBe("POST");
    const body = init.body as string;
    expect(body).toContain("amount=999");
    expect(body).toContain("currency=usd");
    expect(body).toContain("metadata%5BuserId%5D=user-1");
    expect(body).toContain("metadata%5Btier%5D=beginner");
  });

  it("POST /create-payment-intent rejects amount mismatch for tier", async () => {
    const res = await request(createTestApp())
      .post("/billing/create-payment-intent")
      .set("Authorization", "Bearer fake-token")
      .send({
        amount: 100,
        currency: "usd",
        userId: "user-1",
        tier: "beginner",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_amount");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("POST /create-payment-intent rejects userId that does not match session", async () => {
    const res = await request(createTestApp())
      .post("/billing/create-payment-intent")
      .set("Authorization", "Bearer fake-token")
      .send({
        amount: 999,
        currency: "usd",
        userId: "other-user",
        tier: "beginner",
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("POST /create-payment-intent propagates auth failure from Supabase", async () => {
    mockRequireSupabaseUser.mockRejectedValueOnce(
      new HttpError(401, "Invalid or expired session", { code: "unauthorized" }),
    );

    const res = await request(createTestApp())
      .post("/billing/create-payment-intent")
      .set("Authorization", "Bearer bad")
      .send({
        amount: 999,
        currency: "usd",
        userId: "user-1",
        tier: "beginner",
      });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("unauthorized");
  });

  it("POST /activate-subscription upserts subscription for matching user", async () => {
    const res = await request(createTestApp())
      .post("/billing/activate-subscription")
      .set("Authorization", "Bearer fake-token")
      .send({ userId: "user-1", tier: "master" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, tier: "master" });
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        status: "active",
        plan_id: "master",
        amount_paid: 19.99,
        currency: "USD",
      }),
      { onConflict: "user_id" },
    );
  });

  it("POST /activate-subscription rejects userId that does not match session", async () => {
    const res = await request(createTestApp())
      .post("/billing/activate-subscription")
      .set("Authorization", "Bearer fake-token")
      .send({ userId: "other-user", tier: "beginner" });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("forbidden");
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
