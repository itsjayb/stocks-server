import { Router } from "express";

export const metaRouter = Router();

metaRouter.get("/tiers", (_req, res) => {
  res.json({
    visitorPreview: {
      description:
        "Anonymous visitors (JWT claim visitor: true, or legacy key + X-Visitor-Preview: true) get a subset of Free-tier APIs.",
      endpoints: [
        "GET /v1/market/movers (gainers & losers)",
        "GET /v1/symbols/:symbol/quote (compact watchlist)",
        "GET /v1/symbols/:symbol/news (headline news)",
      ],
    },
    freeAccount: {
      description:
        "Signed-in free accounts get the full Free tier, including unusual volume (most-active). Omit visitor flags or set X-Visitor-Preview: false with legacy key.",
      extraVsVisitor: ["GET /v1/market/most-active (unusual volume)"],
    },
    tiers: {
      free: {
        endpoints: [
          "GET /v1/market/movers",
          "GET /v1/market/most-active (requires free account — not visitor preview)",
          "GET /v1/symbols/:symbol/quote",
          "GET /v1/symbols/:symbol/news",
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
      visitorPreview:
        "Legacy key only: X-Visitor-Preview: true means anonymous visitor (subset of Free tier). JWT: set claim visitor: true for the same. Default / omitted = full Free tier with that key.",
    },
  });
});
