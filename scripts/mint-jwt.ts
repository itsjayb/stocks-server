/**
 * Mint a short-lived API JWT for testing or for your billing service to call.
 * Usage: STOCKS_SERVER_JWT_SECRET=yoursecret npx tsx scripts/mint-jwt.ts <sub> <tier> [ttlSeconds]
 * Example: STOCKS_SERVER_JWT_SECRET=devsecret npx tsx scripts/mint-jwt.ts cust_abc beginner 3600
 */
import { SignJWT } from "jose";
import { parseTier, type Tier } from "../src/types/tier.js";

const secret = process.env.STOCKS_SERVER_JWT_SECRET?.trim();
const [sub, tierRaw, ttlRaw] = process.argv.slice(2);
const ttl = ttlRaw ? Number(ttlRaw) : 3600;

if (!secret) {
  console.error("Set STOCKS_SERVER_JWT_SECRET in the environment.");
  process.exit(1);
}
if (!sub || !tierRaw) {
  console.error("Usage: STOCKS_SERVER_JWT_SECRET=... npx tsx scripts/mint-jwt.ts <sub> <tier> [ttlSeconds]");
  process.exit(1);
}
const tier = parseTier(tierRaw);
if (!tier) {
  console.error("tier must be free | beginner | master");
  process.exit(1);
}
if (!Number.isFinite(ttl) || ttl <= 0) {
  console.error("ttlSeconds must be a positive number");
  process.exit(1);
}

const key = new TextEncoder().encode(secret);
const jwt = await new SignJWT({ tier })
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(sub)
  .setIssuedAt()
  .setExpirationTime(`${ttl}s`)
  .sign(key);

console.log(jwt);
