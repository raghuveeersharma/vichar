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
app.use(express.json());
app.use(cookieParser());
app.use("/api", csrfOrigin);

app.use("/api/auth", authRouter);
app.use("/api/notes", protect, router);
app.use("/api/folders", protect, folderRouter);
app.use("/api/ai", protect, aiRateLimiter, aiRouter);

export default app;
