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

// Per-user budget for AI calls (runs after requireAuth, so req.user is set).
export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => req.user?.id ?? "anonymous",
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "You're asking questions too quickly. Please wait a minute and try again." },
});
