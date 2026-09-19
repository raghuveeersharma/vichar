import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const loginLimitMessage = {
  message: "Too many login attempts, please try again later.",
};

// This cap catches a single host cycling through account names. Keep it
// separate from the application-wide limiter: ordinary note activity should
// never consume a user's login-attempt budget.
export const loginIpLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 10,
  message: loginLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});

// An IP-only cap is easy to evade with a botnet. Apply a second cap to a
// normalised email address, so attempts against one account are constrained
// even when they come from several source IPs. Invalid email values are keyed
// by IP, avoiding one shared bucket for malformed requests.
export const loginAccountLimiter = rateLimit({
  windowMs: WINDOW_MS,
  max: 5,
  keyGenerator: (req) => {
    const email = req.body?.email;
    if (typeof email !== "string") return `invalid:${ipKeyGenerator(req.ip)}`;
    return `email:${email.trim().toLowerCase()}`;
  },
  message: loginLimitMessage,
  standardHeaders: true,
  legacyHeaders: false,
});
