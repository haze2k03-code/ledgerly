import type { Request, Response } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import mongoose from "mongoose";
import { config } from "./config.js";
import { User } from "./models/User.js";

export const COOKIE_NAME = "ledgerly_token";
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, { expiresIn: TOKEN_TTL_SECONDS });
}

// httpOnly: page JavaScript can't read the token, so an XSS bug can't steal it.
// sameSite=strict: the browser won't attach it to requests started by other sites (blocks CSRF).
export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: config.COOKIE_SECURE,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

/**
 * Reads the cookie and returns the logged-in user, or null.
 * We load the user from the database instead of trusting the token alone,
 * so a deleted account stops working immediately.
 */
export async function getUserFromRequest(req: Request): Promise<AuthUser | null> {
  const token: unknown = req.cookies?.[COOKIE_NAME];
  if (typeof token !== "string") return null;

  let userId: string;
  try {
    userId = String((jwt.verify(token, config.JWT_SECRET) as JwtPayload).sub);
  } catch {
    return null; // expired or tampered token: treat as logged out
  }
  if (!mongoose.isValidObjectId(userId)) return null;

  const user = await User.findById(userId).select("name email").lean();
  return user ? { id: String(user._id), name: user.name, email: user.email } : null;
}
