import express from "express";
import router from "./routes/notesRoutes.js";
import authRouter from "./routes/authRoutes.js";
import aiRouter from "./routes/aiRoutes.js";
import db from "./config/db.js";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimiter from "./middlewear/rateLimiter.js";
import aiRateLimiter from "./middlewear/aiRateLimiter.js";
import protect from "./middlewear/protect.js";
const app = express();

dotenv.config(); // Load environment variables from .env file

// Fail fast rather than signing tokens with `undefined`, which jsonwebtoken
// would reject at request time with a confusing error.
if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set — see server/.env.example");
  process.exit(1);
}

// Trust the proxy so express-rate-limit sees the real client IP and secure
// cookies are recognised behind Render/Vercel's TLS termination.
app.set("trust proxy", 1);

// middlewares
app.use(
  cors({
    origin: process.env.CORS_ORIGIN, // Allow requests from the frontend
    credentials: true, // required for the httpOnly auth cookie to be sent
  })
); // Enable CORS for all routes
app.use(rateLimiter); // Apply rate limiting middleware
app.use(express.json()); // Parse JSON bodies from the request
app.use(cookieParser()); // Populate req.cookies so `protect` can read the JWT

app.use("/api/auth", authRouter); // Public: signup / login / logout (+ guarded /me)
app.use("/api/notes", protect, router); // Every note route requires a valid session
app.use("/api/ai", protect, aiRateLimiter, aiRouter); // Guarded + its own tighter budget

const PORT = process.env.PORT || 5000;
db().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
