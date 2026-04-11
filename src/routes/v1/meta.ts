import { Router } from "express";

export const metaRouter = Router();

metaRouter.get("/tiers", (_req, res) => {
  res.json({
    visitorPreview: {
      description:
        "Anonymous visitors (no auth when allowed, JWT claim visitor: true, or legacy key + X-Visitor-Preview: true) get a subset of Free-tier APIs.",
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
        "Supabase users: send Authorization: Bearer <access_token>; tier comes from user_subscriptions (ignore client tier headers). Legacy STOCKS_SERVER_API_KEY: X-Subscription-Tier or ?tier=. Per-customer keys and HS256 app JWTs also bind tier server-side.",
      apiKey:
        "X-Api-Key or Authorization: Bearer (API key, HS256 app JWT, or Supabase session JWT). Anonymous browsers may omit credentials when STOCKS_SERVER_V1_ANONYMOUS_VISITOR is not false.",
      visitorPreview:
        "Legacy key: X-Visitor-Preview: true = anonymous visitor. HS256 JWT: claim visitor: true. No credentials + anonymous allowed = visitor. Signed-in Supabase users are full Free tier (or paid tier from DB).",
    },
  });
});
