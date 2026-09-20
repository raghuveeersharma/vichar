import db from "./config/db.js";
import app from "./app.js";
import { logger } from "./libs/logger.js";

// Fail fast rather than signing tokens with `undefined`, which jsonwebtoken
// would reject at request time with a confusing error.
if (!process.env.JWT_SECRET) {
  logger.error("startup.configuration_invalid", { setting: "JWT_SECRET" });
  process.exit(1);
}

// CORS and the CSRF Origin check both rely on one explicit frontend origin.
if (!process.env.CORS_ORIGIN) {
  logger.error("startup.configuration_invalid", { setting: "CORS_ORIGIN" });
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
db().then(() => {
  app.listen(PORT, () => {
    logger.info("server.listening", { port: PORT });
  });
});
