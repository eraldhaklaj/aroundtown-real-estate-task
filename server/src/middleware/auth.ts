import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findUserById } from "../data/users.js";
import type { PublicUser, Role, User } from "../types.js";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

const SESSION_COOKIE = "session";
const SESSION_TTL_SECONDS = 2 * 60 * 60;

const cookieOptions = {
  httpOnly: true, // not readable from JavaScript
  sameSite: "strict", // not sent on cross-site requests (CSRF mitigation)
  secure: config.isProd, // HTTPS-only in production
  path: "/",
} as const;

export function toPublicUser({ passwordHash: _hash, ...user }: User): PublicUser {
  return user;
}

export function issueSession(res: Response, user: User) {
  const token = jwt.sign({ sub: user.id }, config.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: SESSION_TTL_SECONDS,
  });
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearSession(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

/** Rejects the request unless it carries a valid, unexpired session for a known user. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token: unknown = req.cookies?.[SESSION_COOKIE];
  if (typeof token !== "string") {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] });
    const user = typeof payload === "object" && typeof payload.sub === "string" ? findUserById(payload.sub) : undefined;
    if (!user) throw new Error("unknown user");
    // Role is read from the user store, not trusted from the token.
    req.user = toPublicUser(user);
    next();
  } catch {
    clearSession(res);
    res.status(401).json({ error: "Session expired. Please sign in again." });
  }
}

export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      res.status(403).json({ error: "You do not have access to this feature" });
      return;
    }
    next();
  };
}
