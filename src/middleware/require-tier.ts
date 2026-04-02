import type { NextFunction, Request, Response } from "express";
import { tierMeets, type Tier } from "../types/tier.js";

export function requireTier(min: Tier) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!tierMeets(min, req.subscriptionTier)) {
      res.status(403).json({
        error: "tier_required",
        message: `This endpoint requires the ${min} tier or higher.`,
        requiredTier: min,
        currentTier: req.subscriptionTier,
      });
      return;
    }
    next();
  };
}
