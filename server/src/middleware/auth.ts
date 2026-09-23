import { randomBytes } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { findUserById } from "../data/users.js";
import type { PublicUser, Role, User } from "../types.js";
import { HttpError } from "./error.js";

declare global {
  namespace Express {
    interface Request {
      /** Set when the request carries a valid logged-in session ("token" cookie). */
      user?: PublicUser;
      /** Set for guests. `isNew` means the anonymous session was issued on this very request. */
      anon?: { id: string; isNew: boolean };
    }
  }
}

// Two separate cookies: "token" for signed-in users, "a" for anonymous guests.
const USER_COOKIE = "token";
const ANON_COOKIE = "a";
const USER_TTL_SECONDS = 2 * 60 * 60;
const ANON_TTL_SECONDS = 30 * 24 * 60 * 60;

type TokenType = "user" | "anon";

const cookieOptions = {
  httpOnly: true, // not readable from JavaScript
  sameSite: "strict", // not sent on cross-site requests (CSRF mitigation)
  secure: config.isProd, // HTTPS-only in production
  path: "/",
} as const;

export function toPublicUser({ passwordHash: _hash, ...user }: User): PublicUser {
  return user;
}

function sign(sub: string, typ: TokenType, ttlSeconds: number) {
  return jwt.sign({ sub, typ }, config.JWT_SECRET, { algorithm: "HS256", expiresIn: ttlSeconds });
}

/** Returns the subject of a valid token of the expected type, or null. The `typ` claim stops one cookie being replayed as the other. */
function verify(token: unknown, typ: TokenType): string | null {
  if (typeof token !== "string") return null;
  try {
    const payload = jwt.verify(token, config.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "object" && payload.typ === typ && typeof payload.sub === "string") return payload.sub;
  } catch {
    // expired, tampered or malformed: treated as absent
  }
  return null;
}

export function issueUserSession(res: Response, user: User) {
  res.cookie(USER_COOKIE, sign(user.id, "user", USER_TTL_SECONDS), { ...cookieOptions, maxAge: USER_TTL_SECONDS * 1000 });
}

export function clearUserSession(res: Response) {
  res.clearCookie(USER_COOKIE, cookieOptions);
}

/**
 * Runs on every API request. Resolves the caller to a signed-in user or an anonymous guest.
 * Guests without a valid "a" cookie get a fresh one, so everyone has a stable identity for quotas.
 */
export function identify(req: Request, res: Response, next: NextFunction) {
  const userId = verify(req.cookies?.[USER_COOKIE], "user");
  const user = userId ? findUserById(userId) : undefined;
  if (user) {
    // Role is read from the user store, never trusted from the token.
    req.user = toPublicUser(user);
    next();
    return;
  }
  if (req.cookies?.[USER_COOKIE] !== undefined) clearUserSession(res);

  const anonId = verify(req.cookies?.[ANON_COOKIE], "anon");
  if (anonId) {
    req.anon = { id: anonId, isNew: false };
  } else {
    const id = `anon-${randomBytes(12).toString("hex")}`;
    res.cookie(ANON_COOKIE, sign(id, "anon", ANON_TTL_SECONDS), { ...cookieOptions, maxAge: ANON_TTL_SECONDS * 1000 });
    req.anon = { id, isNew: true };
  }
  next();
}

export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw new HttpError(401, "Please sign in to continue", "login_required");
    if (req.user.role !== role) throw new HttpError(403, "You do not have access to this feature");
    next();
  };
}
