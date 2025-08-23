import express from "express";
import router from "./routes/notesRoutes.js";
import db from "./config/db.js";
import dotenv from "dotenv";
import cors from "cors";
import rateLimiter from "./middlewear/rateLimiter.js";
const app = express();

dotenv.config(); // Load environment variables from .env file

// middlewares
app.use(
  cors({
    origin: "https://vichar-three.vercel.app", // Allow requests from the frontend
  })
); // Enable CORS for all routes
app.use(rateLimiter); // Apply rate limiting middleware
app.use(express.json()); // Parse JSON bodies from the request
app.use("/api/notes", router); // Use the notes routes defined in notesRoutes.js

const PORT = process.env.PORT || 5000;
db().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
