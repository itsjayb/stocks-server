import { Router } from "express";
import { extractBearer } from "../lib/bearer.js";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { createAnonSupabase, createUserSupabase } from "../lib/supabase-app.js";

export const socialRouter = Router();

interface SocialShareBody {
  share_type: string;
  content_type: string;
  content_id: string;
  content_name: string;
  share_url: string;
}

/**
 * Records a share (patterns, etc.). Uses the caller's Supabase JWT when present so RLS applies;
 * otherwise inserts with the anon client (same as a logged-out browser client).
 */
socialRouter.post(
  "/shares",
  asyncHandler(async (req, res) => {
    const body = req.body as SocialShareBody;
    const { share_type, content_type, content_id, content_name, share_url } = body ?? {};
    if (
      typeof share_type !== "string" ||
      typeof content_type !== "string" ||
      typeof content_id !== "string" ||
      typeof content_name !== "string" ||
      typeof share_url !== "string"
    ) {
      throw new HttpError(400, "Invalid share payload", { code: "invalid_body" });
    }

    const token = extractBearer(req);
    const supabase = token ? createUserSupabase(token) : createAnonSupabase();

    const { error } = await supabase.from("social_shares").insert({
      share_type,
      content_type,
      content_id,
      content_name,
      share_url,
    });

    if (error) {
      throw new HttpError(400, error.message, { code: "db_error" });
    }

    res.status(201).json({ ok: true });
  }),
);
