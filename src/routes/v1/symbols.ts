import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import { requireFinnhubConfigured } from "../../middleware/require-finnhub.js";
import { requireTier } from "../../middleware/require-tier.js";
import * as finnhub from "../../services/finnhub.js";

export const symbolsRouter = Router();

symbolsRouter.use(requireFinnhubConfigured);

const SYMBOL_RE = /^[A-Za-z0-9.-]{1,16}$/;

function parseSymbol(raw: string | string[] | undefined): string {
  const one = Array.isArray(raw) ? raw[0] : raw;
  if (typeof one !== "string") {
    throw new HttpError(400, "Missing symbol", { code: "invalid_symbol" });
  }
  const s = one.trim().toUpperCase();
  if (!SYMBOL_RE.test(s)) {
    throw new HttpError(400, "Invalid symbol", { code: "invalid_symbol" });
  }
  return s;
}

function defaultNewsRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}

symbolsRouter.get(
  "/:symbol/quote",
  requireTier("beginner"),
  asyncHandler(async (req, res) => {
    const symbol = parseSymbol(req.params.symbol);
    const data = await finnhub.getQuote(symbol);
    res.json({ symbol, tier: req.subscriptionTier, quote: data });
  }),
);

symbolsRouter.get(
  "/:symbol/news",
  requireTier("beginner"),
  asyncHandler(async (req, res) => {
    const symbol = parseSymbol(req.params.symbol);
    const { from, to } =
      typeof req.query.from === "string" && typeof req.query.to === "string"
        ? { from: req.query.from, to: req.query.to }
        : defaultNewsRange();
    const data = await finnhub.getCompanyNews(symbol, from, to);
    res.json({ symbol, from, to, tier: req.subscriptionTier, news: data });
  }),
);

symbolsRouter.get(
  "/:symbol/profile",
  requireTier("master"),
  asyncHandler(async (req, res) => {
    const symbol = parseSymbol(req.params.symbol);
    const data = await finnhub.getProfile(symbol);
    res.json({ symbol, tier: req.subscriptionTier, profile: data });
  }),
);

symbolsRouter.get(
  "/:symbol/insider",
  requireTier("master"),
  asyncHandler(async (req, res) => {
    const symbol = parseSymbol(req.params.symbol);
    const data = await finnhub.getInsiderTransactions(symbol);
    res.json({ symbol, tier: req.subscriptionTier, insider: data });
  }),
);
