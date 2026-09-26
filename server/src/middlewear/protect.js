import User from "../modals/user.modal.js";
import { verifyToken, COOKIE_NAME, clearTokenCookie } from "../libs/token.js";
import { logError } from "../libs/logger.js";

// Guards every route it is mounted on: reads the httpOnly cookie, verifies the
// JWT, and attaches the user document as req.user for downstream handlers.
export default async function protect(req, res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      clearTokenCookie(res); // expired or tampered — drop the stale cookie
      return res.status(401).json({ message: "Session expired" });
    }

    const user = await User.findById(payload.id).select("+sessionVersion");
    if (!user) {
      clearTokenCookie(res); // account deleted while the token was still valid
      return res.status(401).json({ message: "Not authenticated" });
    }

    // Treat legacy JWTs/documents without this field as version zero, so the
    // rollout does not sign everyone out until their first credential change.
    if ((payload.sessionVersion ?? 0) !== (user.sessionVersion ?? 0)) {
      clearTokenCookie(res);
      return res.status(401).json({ message: "Session expired" });
    }

    req.user = user;
    next();
  } catch (error) {
    logError(req, "auth.protection_failed", error);
    res.status(500).json({ message: "Internal server error" });
  }
}
