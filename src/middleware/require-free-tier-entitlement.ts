import type { NextFunction, Request, Response } from "express";
import {
  canAccessFreeTierFeature,
  type FreeTierFeatureId,
} from "../types/free-tier-entitlements.js";

/**
 * Enforces Free-tier feature matrix: visitors only get VISITOR_PREVIEW features;
 * signed-in free accounts get the full Free tier (see `free-tier-entitlements.ts`).
 */
export function requireFreeTierEntitlement(featureId: FreeTierFeatureId) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const hasFreeAccount = req.hasFreeAccount !== false;
    if (!canAccessFreeTierFeature(featureId, { hasFreeAccount })) {
      res.status(403).json({
        error: "free_entitlement_required",
        message:
          "This endpoint requires a free account. Visitors can use gainers & losers, compact watchlist, and headline news.",
        feature: featureId,
        visitorPreview: !hasFreeAccount,
      });
      return;
    }
    next();
  };
}
