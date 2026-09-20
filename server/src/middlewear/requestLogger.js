import { randomUUID } from "node:crypto";
import { logger, requestContext } from "../libs/logger.js";

// Generate the id server-side rather than trusting a caller-controlled header.
// It correlates the completion log with any error log for the same request and
// is returned to clients for useful support reports.
export default function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();
  req.id = randomUUID();
  // `req.path` is router-relative by the time a response finishes. Preserve
  // the original pathname and omit its query string, which can hold user data.
  req.logPath = req.originalUrl.split("?", 1)[0];
  res.setHeader("X-Request-Id", req.id);

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info";
    logger[level]("http_request_completed", {
      ...requestContext(req),
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(1)),
    });
  });

  next();
}
