import { Router } from "express";
import { asyncHandler } from "../lib/async-handler.js";
import { HttpError } from "../lib/http-error.js";
import { createAnonSupabase } from "../lib/supabase-app.js";

export const authRouter = Router();

authRouter.post(
  "/signin",
  asyncHandler(async (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      throw new HttpError(400, "email and password are required", { code: "invalid_body" });
    }
    const supabase = createAnonSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new HttpError(400, error.message, { code: "auth_error" });
    }
    res.json({ session: data.session });
  }),
);

authRouter.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const { email, password, fullName } = req.body ?? {};
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      throw new HttpError(400, "email and password are required", { code: "invalid_body" });
    }
    const supabase = createAnonSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: typeof fullName === "string" ? fullName : "" },
      },
    });
    if (error) {
      throw new HttpError(400, error.message, { code: "auth_error" });
    }
    res.json({ ok: true, user: data.user ?? null });
  }),
);
