import type { Request } from "express";

export function extractBearer(req: Request): string | undefined {
  const auth = req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

/** For `/v1` auth: `X-Api-Key` or `Authorization: Bearer` (JWT or API key). */
export function extractApiCredential(req: Request): string | undefined {
  const h = req.header("x-api-key");
  if (h) return h.trim();
  return extractBearer(req);
}
