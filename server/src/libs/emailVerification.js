import crypto from "node:crypto";
import jwt from "jsonwebtoken";

// Keep the database expiry in addition to the JWT expiry. The former lets a
// resend invalidate an older link and is the state that makes a link one-use.
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;

export function hashVerificationId(id) {
  return crypto.createHash("sha256").update(id).digest("hex");
}

export function createEmailVerificationToken(userId) {
  const id = crypto.randomBytes(32).toString("base64url");
  const token = jwt.sign(
    { purpose: "email-verification", id: userId.toString(), jti: id },
    process.env.JWT_SECRET,
    { expiresIn: Math.floor(EMAIL_VERIFICATION_TTL_MS / 1000) }
  );

  return {
    token,
    tokenHash: hashVerificationId(id),
    expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
  };
}

export function readEmailVerificationToken(token) {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (
    payload?.purpose !== "email-verification" ||
    typeof payload.id !== "string" ||
    typeof payload.jti !== "string"
  ) {
    throw new Error("Invalid email verification token");
  }
  return payload;
}
