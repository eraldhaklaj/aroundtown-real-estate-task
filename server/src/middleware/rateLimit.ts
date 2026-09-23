import type { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";

// Only failed attempts count, so a legitimate user is never locked out by their own logins.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many failed sign-in attempts. Please wait 15 minutes and try again." },
});

// Signed-in users: per-user budget for AI calls.
const userAiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user?.id ?? "unknown",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "You're asking questions too quickly. Please wait a minute and try again." },
});

// Guests: per-IP cap on top of the one-question quota, so clearing cookies doesn't buy unlimited free AI calls.
const guestAiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Free question limit reached. Please sign in to keep asking.", code: "login_required" },
});

export function aiLimiter(req: Request, res: Response, next: NextFunction) {
  return req.user ? userAiLimiter(req, res, next) : guestAiLimiter(req, res, next);
}
