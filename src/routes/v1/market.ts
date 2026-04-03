import { Router } from "express";
import { alpacaConfigured } from "../../config/env.js";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import { requireFreeTierEntitlement } from "../../middleware/require-free-tier-entitlement.js";
import { maxTopForTier } from "../../types/tier.js";
import {
  getTopGainersLosers,
  isAlphaVantageConfigured,
} from "../../services/alphavantage.js";
import { getMostActives, getStockMovers } from "../../services/alpaca-data.js";

export const marketRouter = Router();

function parseTop(raw: unknown, tierTop: number): number {
  const n = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || n < 1) return Math.min(10, tierTop);
  return Math.min(Math.floor(n), tierTop);
}

type Source = "auto" | "alpaca" | "alphavantage";

function parseSource(raw: unknown): Source {
  if (raw === "alpaca" || raw === "alphavantage" || raw === "auto") return raw;
  return "auto";
}

function assertAlpacaWhenRequired(source: Source, alpacaOk: boolean): void {
  if (source === "alpaca" && !alpacaOk) {
    throw new HttpError(503, "Alpaca is not configured; set ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY", {
      code: "alpaca_unconfigured",
    });
  }
}

function assertAlphaVantageConfigured(): void {
  if (!isAlphaVantageConfigured()) {
    throw new HttpError(503, "Alpha Vantage is not configured; set ALPHA_VANTAGE_API_KEY", {
      code: "alphavantage_unconfigured",
    });
  }
}

marketRouter.get(
  "/movers",
  asyncHandler(async (req, res) => {
    const tierTop = maxTopForTier(req.subscriptionTier);
    const top = parseTop(req.query.top, tierTop);
    const source = parseSource(req.query.source);
    const alpacaOk = alpacaConfigured();
    const wantAlpaca = source === "alpaca" || (source === "auto" && alpacaOk);

    if (wantAlpaca && alpacaOk) {
      const data = await getStockMovers(top);
      res.json({ source: "alpaca", top, tier: req.subscriptionTier, ...data });
      return;
    }

    assertAlpacaWhenRequired(source, alpacaOk);
    assertAlphaVantageConfigured();

    const snap = await getTopGainersLosers();
    res.json({
      source: snap.source,
      top,
      tier: req.subscriptionTier,
      last_updated: snap.last_updated,
      gainers: snap.gainers.slice(0, top),
      losers: snap.losers.slice(0, top),
    });
  }),
);

marketRouter.get(
  "/most-active",
  requireFreeTierEntitlement("unusual_volume"),
  asyncHandler(async (req, res) => {
    const tierTop = maxTopForTier(req.subscriptionTier);
    const top = parseTop(req.query.top, tierTop);
    const source = parseSource(req.query.source);
    const by = req.query.by === "trades" ? "trades" : "volume";
    const alpacaOk = alpacaConfigured();
    const wantAlpaca = source === "alpaca" || (source === "auto" && alpacaOk);

    if (wantAlpaca && alpacaOk) {
      try {
        const data = await getMostActives(top, by);
        res.json({ source: "alpaca", top, by, tier: req.subscriptionTier, ...data });
        return;
      } catch (e) {
        if (source === "alpaca") throw e;
      }
    }

    assertAlpacaWhenRequired(source, alpacaOk);
    assertAlphaVantageConfigured();

    const snap = await getTopGainersLosers();
    res.json({
      source: "alphavantage",
      top,
      by: "volume",
      tier: req.subscriptionTier,
      most_actives: snap.most_active.slice(0, top),
      last_updated: snap.last_updated,
    });
  }),
);
