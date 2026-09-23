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

// Listing generator (agents only). Property Q&A has its own, finer-grained limits in ai/qaLimits.ts.
export const generatorLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  keyGenerator: (req) => req.user?.id ?? "unknown",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many drafts in a short time. Please wait a minute and try again.", code: "rate_limited" },
});
