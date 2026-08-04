import express from "express";
import {
  signup,
  login,
  logout,
  me,
  updateEmail,
  updatePassword,
  updatePreferences,
} from "../controllers/authControllers.js";
import protect from "../middlewear/protect.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/me", protect, me);
router.patch("/email", protect, updateEmail);
router.patch("/password", protect, updatePassword);
router.patch("/preferences", protect, updatePreferences);

export default router;
