import { Router } from "express";
import { asyncHandler } from "../../lib/async-handler.js";
import { HttpError } from "../../lib/http-error.js";
import { requireFinnhubConfigured } from "../../middleware/require-finnhub.js";
import * as finnhub from "../../services/finnhub.js";

export const calendarRouter = Router();

calendarRouter.use(requireFinnhubConfigured);

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(name: string, raw: unknown): string {
  if (typeof raw !== "string" || !ISO_DATE.test(raw)) {
    throw new HttpError(400, `Query parameter ${name} must be YYYY-MM-DD`, {
      code: "invalid_date",
    });
  }
  return raw;
}

calendarRouter.get(
  "/earnings",
  asyncHandler(async (req, res) => {
    const from = parseDate("from", req.query.from);
    const to = parseDate("to", req.query.to);
    const data = await finnhub.getEarningsCalendar(from, to);
    res.json({ from, to, tier: req.subscriptionTier, earnings: data });
  }),
);
