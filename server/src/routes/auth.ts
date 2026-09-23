import bcrypt from "bcryptjs";
import { Router } from "express";
import { findUserByEmail } from "../data/users.js";
import { log } from "../log.js";
import { maskEmail } from "../pii.js";
import { clearUserSession, issueUserSession, toPublicUser } from "../middleware/auth.js";
import { loginLimiter } from "../middleware/rateLimit.js";
import { LoginSchema, parse } from "../validation.js";

export const authRouter = Router();

// Compared against when the email is unknown, so response timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = parse(LoginSchema, req.body);
  const user = findUserByEmail(email);
  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !passwordOk) {
    log.warn("auth.login_failed", { email: maskEmail(email), ip: req.ip });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  issueUserSession(res, user);
  log.info("auth.login", { userId: user.id });
  res.json({ user: toPublicUser(user) });
});

// Logging out only clears the user cookie; the guest cookie "a" stays, so its used quota isn't reset.
authRouter.post("/logout", (_req, res) => {
  clearUserSession(res);
  res.status(204).end();
});

/** The signed-in user, or null for guests. The first call also gives a new guest their anonymous "a" session. */
authRouter.get("/me", (req, res) => {
  res.json({ user: req.user ?? null });
});
