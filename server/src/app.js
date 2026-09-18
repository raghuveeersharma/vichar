import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import router from "./routes/notesRoutes.js";
import authRouter from "./routes/authRoutes.js";
import folderRouter from "./routes/folderRoutes.js";
import aiRouter from "./routes/aiRoutes.js";
import rateLimiter from "./middlewear/rateLimiter.js";
import aiRateLimiter from "./middlewear/aiRateLimiter.js";
import protect from "./middlewear/protect.js";
import csrfOrigin from "./middlewear/csrfOrigin.js";

dotenv.config({ quiet: process.env.NODE_ENV === "test" });

// Exporting the configured app lets integration tests exercise the same
// middleware and routers as production without opening a port or connecting to
// MongoDB as an import side effect. index.js owns those process concerns.
const app = express();

app.set("trust proxy", 1);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(rateLimiter);
// Keep a malformed or oversized JSON document from reaching controllers (or
// allocating unbounded memory). Individual fields have tighter limits in the
// request validators where appropriate.
app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());
app.use("/api", csrfOrigin);

app.use("/api/auth", authRouter);
app.use("/api/notes", protect, router);
app.use("/api/folders", protect, folderRouter);
app.use("/api/ai", protect, aiRateLimiter, aiRouter);

// express.json() reports parser failures outside route handlers. Give clients
// the same JSON error shape as the rest of the API instead of its HTML default.
app.use((error, _req, res, _next) => {
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large" });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Request body must be valid JSON" });
  }
  console.error("Unhandled request error:", error);
  return res.status(500).json({ message: "Internal server error" });
});

export default app;
