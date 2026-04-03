/**
 * Mint a short-lived API JWT for testing or for your billing service to call.
 * Usage: STOCKS_SERVER_JWT_SECRET=yoursecret npx tsx scripts/mint-jwt.ts <sub> <tier> [ttlSeconds] [visitor]
 * Example: STOCKS_SERVER_JWT_SECRET=devsecret npx tsx scripts/mint-jwt.ts cust_abc beginner 3600
 * Visitor preview (anonymous): add "true" as last arg to set claim visitor: true
 */
import { SignJWT } from "jose";
import { parseTier, type Tier } from "../src/types/tier.js";

const secret = process.env.STOCKS_SERVER_JWT_SECRET?.trim();
const argv = process.argv.slice(2);
const sub = argv[0];
const tierRaw = argv[1];
let ttl = 3600;
let visitor = false;
if (argv.length >= 3) {
  const third = argv[2];
  const fourth = argv[3];
  const n = Number(third);
  if (Number.isFinite(n) && n > 0) {
    ttl = n;
    visitor = fourth === "true" || fourth === "visitor";
  } else if (third === "true" || third === "visitor") {
    visitor = true;
  }
}

if (!secret) {
  console.error("Set STOCKS_SERVER_JWT_SECRET in the environment.");
  process.exit(1);
}
if (!sub || !tierRaw) {
  console.error(
    "Usage: STOCKS_SERVER_JWT_SECRET=... npx tsx scripts/mint-jwt.ts <sub> <tier> [ttlSeconds] [visitor:true]",
  );
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
const body: { tier: Tier; visitor?: boolean } = { tier };
if (visitor) {
  body.visitor = true;
}

const jwt = await new SignJWT(body)
  .setProtectedHeader({ alg: "HS256" })
  .setSubject(sub)
  .setIssuedAt()
  .setExpirationTime(`${ttl}s`)
  .sign(key);

console.log(jwt);
