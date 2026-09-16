// Cookie authentication needs an explicit CSRF boundary when the cookie uses
// SameSite=None in production. Browsers attach that cookie to a cross-site
// request, but they do not let another site forge its Origin header.
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default function csrfOrigin(req, res, next) {
  if (!UNSAFE_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get("Origin");
  if (origin !== process.env.CORS_ORIGIN) {
    return res.status(403).json({ message: "Invalid request origin" });
  }

  next();
}
