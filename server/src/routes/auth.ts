import bcrypt from "bcryptjs";
import { Router } from "express";
import { findUserByEmail } from "../data/users.js";
import { log } from "../log.js";
import { clearSession, issueSession, requireAuth, toPublicUser } from "../middleware/auth.js";
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
    log.warn("auth.login_failed", { email, ip: req.ip });
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  issueSession(res, user);
  log.info("auth.login", { userId: user.id });
  res.json({ user: toPublicUser(user) });
});

authRouter.post("/logout", (_req, res) => {
  clearSession(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
