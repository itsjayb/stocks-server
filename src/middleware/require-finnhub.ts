import type { NextFunction, Request, Response } from "express";
import { finnhubConfigured } from "../config/env.js";
import { HttpError } from "../lib/http-error.js";

export function requireFinnhubConfigured(_req: Request, _res: Response, next: NextFunction): void {
  if (!finnhubConfigured()) {
    next(
      new HttpError(503, "Finnhub is not configured; set FINNHUB_API_KEY", {
        code: "finnhub_unconfigured",
      }),
    );
    return;
  }
  next();
}
