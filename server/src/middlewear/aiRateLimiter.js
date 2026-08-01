import rateLimit from "express-rate-limit";

// Stricter than the app-wide limiter because every request here costs money.
// This sits *after* the global limiter, so an AI request consumes budget from
// both — 15 is the ceiling, not an extra allowance.
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15,
  message: { message: "Too many AI requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

export default aiLimiter;
