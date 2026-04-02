import { Router } from "express";

export const metaRouter = Router();

metaRouter.get("/tiers", (_req, res) => {
  res.json({
    tiers: {
      free: {
        endpoints: [
          "GET /v1/market/movers",
          "GET /v1/market/most-active",
        ],
        limits: { maxTop: 10 },
      },
      beginner: {
        endpoints: [
          "GET /v1/market/movers",
          "GET /v1/market/most-active",
          "GET /v1/symbols/:symbol/quote",
          "GET /v1/symbols/:symbol/news",
        ],
        limits: { maxTop: 25 },
      },
      master: {
        endpoints: [
          "GET /v1/market/movers",
          "GET /v1/market/most-active",
          "GET /v1/symbols/:symbol/quote",
          "GET /v1/symbols/:symbol/news",
          "GET /v1/calendar/earnings",
          "GET /v1/symbols/:symbol/profile",
          "GET /v1/symbols/:symbol/insider",
        ],
        limits: { maxTop: 50 },
      },
    },
    headers: {
      tier:
        "With legacy STOCKS_SERVER_API_KEY only: X-Subscription-Tier or ?tier=. With STOCKS_SERVER_API_CLIENTS or JWT, tier is set server-side (do not trust client tier headers for billing).",
      apiKey:
        "X-Api-Key or Authorization: Bearer <key>. Use per-customer keys via STOCKS_SERVER_API_CLIENTS, or HS256 JWT signed with STOCKS_SERVER_JWT_SECRET (claims: sub, tier, exp).",
    },
  });
});
