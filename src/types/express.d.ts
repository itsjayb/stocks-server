import type { Tier } from "./tier.js";

declare global {
  namespace Express {
    interface Request {
      subscriptionTier: Tier;
      /** Set when authenticated via API client list or JWT (`sub`). */
      authSubject?: string;
      /**
       * When false, caller is treated as an anonymous visitor (JWT `visitor: true` or legacy
       * `X-Visitor-Preview: true`). Unusual volume and similar require a free account.
       * Omitted/true preserves legacy behavior (full Free tier with a valid API key).
       */
      hasFreeAccount?: boolean;
    }
  }
}

export {};
