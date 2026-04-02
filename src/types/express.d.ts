import type { Tier } from "./tier.js";

declare global {
  namespace Express {
    interface Request {
      subscriptionTier: Tier;
      /** Set when authenticated via API client list or JWT (`sub`). */
      authSubject?: string;
    }
  }
}

export {};
