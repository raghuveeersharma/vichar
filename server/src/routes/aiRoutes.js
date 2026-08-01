import express from "express";
import { fixGrammar, formatNote } from "../controllers/aiControllers.js";

const router = express.Router();

// `protect` and the AI rate limiter are mounted on the router in index.js, so
// a route added here cannot forget either one.
router.post("/grammar", fixGrammar);
router.post("/format", formatNote);

export default router;
