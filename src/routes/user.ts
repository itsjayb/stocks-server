import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { requireSupabaseUser } from "../lib/supabase-app.js";

export const userRouter = Router();

userRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const { user, supabase } = await requireSupabaseUser(req);

    const [profileRes, subscriptionRes] = await Promise.all([
      supabase.from("user_profiles").select("*").eq("id", user.id).maybeSingle(),
      supabase.from("user_subscriptions").select("*").eq("user_id", user.id).maybeSingle(),
    ]);

    if (profileRes.error) {
      throw new HttpError(400, profileRes.error.message, { code: "profile_error" });
    }

    res.json({
      user,
      profile: profileRes.data,
      subscription: subscriptionRes.error ? null : subscriptionRes.data ?? null,
    });
  }),
);
