import rateLimit from "express-rate-limit";

/** Sign-in / sign-up brute-force protection */
export const authRouteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit",
    message: "Too many authentication attempts. Try again later.",
  },
});

export const billingRouteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit",
    message: "Too many requests. Try again later.",
  },
});

export const userRouteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit",
    message: "Too many requests. Try again later.",
  },
});

export const socialRouteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "rate_limit",
    message: "Too many requests. Try again later.",
  },
});
