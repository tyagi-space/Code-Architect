import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { parse, serialize } from "cookie";

export type SessionPayload = {
  userId: number;
  role?: string;
};

const COOKIE_NAME = "session";
const SESSION_SECRET =
  process.env.SESSION_SECRET || "dev-session-secret-change-me";
const COOKIE_SECURE =
  process.env.SESSION_COOKIE_SECURE === "true" ||
  process.env.NODE_ENV === "production";

declare global {
  namespace Express {
    interface Request {
      auth?: SessionPayload | null;
    }
  }
}

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: maxAgeSeconds,
  };
}

export function attachAuth(req: Request, _res: Response, next: NextFunction) {
  req.auth = readSession(req);
  next();
}

export function readSession(req: Request): SessionPayload | null {
  const cookies = parse(req.headers.cookie || "");
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, SESSION_SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export function setSession(res: Response, payload: SessionPayload) {
  const token = jwt.sign(payload, SESSION_SECRET, { expiresIn: "7d" });
  res.setHeader(
    "Set-Cookie",
    serialize(COOKIE_NAME, token, cookieOptions(60 * 60 * 24 * 7)),
  );
}

export function clearSession(res: Response) {
  res.setHeader(
    "Set-Cookie",
    serialize(COOKIE_NAME, "", cookieOptions(0)),
  );
}
