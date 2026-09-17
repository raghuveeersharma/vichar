import db from "./config/db.js";
import app from "./app.js";

// Fail fast rather than signing tokens with `undefined`, which jsonwebtoken
// would reject at request time with a confusing error.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set — see server/.env.example");
  process.exit(1);
}

// CORS and the CSRF Origin check both rely on one explicit frontend origin.
if (!process.env.CORS_ORIGIN) {
  console.error("CORS_ORIGIN is not set — see server/.env.example");
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
db().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
