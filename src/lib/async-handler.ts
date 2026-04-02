import type { NextFunction, Request, RequestHandler, Response } from "express";
import { HttpError } from "./http-error.js";

const isProduction = process.env.NODE_ENV === "production";

type AsyncReqHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

export function asyncHandler(fn: AsyncReqHandler): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    const body: Record<string, unknown> = {
      error: err.code ?? "error",
      message: err.message,
    };
    /** Avoid leaking internal context to clients in production. */
    if (!isProduction && err.details !== undefined) {
      body.details = err.details;
    }
    res.status(err.status).json(body);
    return;
  }

  console.error(err);
  res.status(500).json({ error: "internal_error", message: "Unexpected server error" });
}
