import crypto from "node:crypto";
import jwt from "jsonwebtoken";

// A reset link is deliberately shorter lived than an email-verification link.
// The database expiry makes it one-use and lets a later request replace it.
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;

export function hashPasswordResetId(id) {
  return crypto.createHash("sha256").update(id).digest("hex");
}

export function createPasswordResetToken(userId) {
  const id = crypto.randomBytes(32).toString("base64url");
  const token = jwt.sign(
    { purpose: "password-reset", id: userId.toString(), jti: id },
    process.env.JWT_SECRET,
    { expiresIn: Math.floor(PASSWORD_RESET_TTL_MS / 1000) }
  );

  return {
    token,
    tokenHash: hashPasswordResetId(id),
    expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  };
}

export function readPasswordResetToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (
    payload?.purpose !== "password-reset" ||
    typeof payload.id !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid password reset token");
  }
  return payload;
}
