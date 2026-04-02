import { Router } from "express";
import { apiAuthAndTier } from "../../middleware/api-auth-tier.js";
import { requireTier } from "../../middleware/require-tier.js";
import { calendarRouter } from "./calendar.js";
import { marketRouter } from "./market.js";
import { metaRouter } from "./meta.js";
import { symbolsRouter } from "./symbols.js";

export const v1Router = Router();

v1Router.use("/meta", metaRouter);

v1Router.use(apiAuthAndTier);

v1Router.use("/market", marketRouter);

v1Router.use("/symbols", symbolsRouter);

v1Router.use("/calendar", requireTier("master"), calendarRouter);
