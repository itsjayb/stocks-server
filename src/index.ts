import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { isOriginAllowed } from "./config/cors.js";
import { env } from "./config/env.js";
import { errorHandler } from "./lib/async-handler.js";
import {
  authRouteLimiter,
  billingRouteLimiter,
  socialRouteLimiter,
  userRouteLimiter,
} from "./middleware/rate-limit.js";
import { authRouter } from "./routes/auth.js";
import { billingRouter } from "./routes/billing.js";
import { socialRouter } from "./routes/social.js";
import { userRouter } from "./routes/user.js";
import { v1Router } from "./routes/v1/index.js";

const LOG = "[stocks-server]";

function logStartupConfig(): void {
  const missing: string[] = [];
  if (!env.supabaseUrl) missing.push("SUPABASE_URL");
  if (!env.supabaseAnonKey) missing.push("SUPABASE_ANON_KEY");
  if (missing.length > 0) {
    console.warn(
      `${LOG} Supabase: not configured (missing ${missing.join(", ")}) — /auth, /user, /billing need both`,
    );
  } else {
    let host: string;
    try {
      host = new URL(env.supabaseUrl!).hostname;
    } catch {
      host = "(invalid SUPABASE_URL)";
    }
    console.log(`${LOG} Supabase: ok (host=${host})`);
  }
  console.log(
    `${LOG} Stripe: ${env.stripeSecretKey ? "configured" : "not set"} — /billing/create-payment-intent needs STRIPE_SECRET_KEY`,
  );
  console.log(
    `${LOG} Market data: finnhub=${Boolean(env.finnhubApiKey)} alpaca=${Boolean(env.alpacaApiKeyId && env.alpacaApiSecretKey)}`,
  );
}

const app = express();
app.disable("x-powered-by");

if (env.trustProxy) {
  app.set("trust proxy", 1);
}

/** Before helmet: some security headers can interfere with preflight; `cors` handles OPTIONS correctly. */
app.use(
  cors({
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, origin ?? true);
      } else {
        callback(null, false);
      }
    },
    methods: ["GET", "HEAD", "POST", "OPTIONS"],
    // Omit allowedHeaders so preflight echoes `Access-Control-Request-Headers` (SPAs often add more than we list).
    credentials: true,
    maxAge: 7200,
    optionsSuccessStatus: 204,
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

app.use(express.json({ limit: "256kb" }));

if (env.nodeEnv === "production" && env.corsOrigins.length === 0) {
  console.warn(
    `${LOG} STOCKS_SERVER_CORS_ORIGINS is empty in production — built-in Vite localhost origins still apply; add your deployed SPA origin(s) to STOCKS_SERVER_CORS_ORIGINS.`,
  );
}

logStartupConfig();

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "stocks-server" });
});
app.head("/health", (_req, res) => {
  res.status(200).end();
});

/** App API: auth, profile, billing, social — proxied from the SPA instead of calling Supabase/Edge directly. */
app.use("/auth", authRouteLimiter, authRouter);
app.use("/user", userRouteLimiter, userRouter);
app.use("/billing", billingRouteLimiter, billingRouter);
app.use("/social", socialRouteLimiter, socialRouter);

app.use("/v1", v1Router);

app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`${LOG} listening on http://localhost:${env.port} (NODE_ENV=${env.nodeEnv})`);
});
