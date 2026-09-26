import jwt from "jsonwebtoken";

const COOKIE_NAME = "token";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In production the frontend (Vercel) and API (Render) are on different sites,
// so the cookie must be SameSite=None, which browsers only accept with Secure.
const isProduction = () => process.env.NODE_ENV === "production";

export function signToken(userId, sessionVersion = 0) {
  return jwt.sign({ id: userId, sessionVersion }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

export function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

export function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: MAX_AGE_MS,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
  });
}

export function clearTokenCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction(),
    sameSite: isProduction() ? "none" : "lax",
  });
}

export { COOKIE_NAME };
