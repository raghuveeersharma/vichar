import express from "express";
import {
  signup,
  login,
  logout,
  me,
  updateEmail,
  updatePassword,
  updatePreferences,
  resendEmailVerification,
  verifyEmail,
} from "../controllers/authControllers.js";
import protect from "../middlewear/protect.js";
import {
  loginAccountLimiter,
  loginIpLimiter,
  verificationAttemptLimiter,
  verificationResendLimiter,
} from "../middlewear/authRateLimiter.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", loginIpLimiter, loginAccountLimiter, login);
router.post("/logout", logout);
router.post("/verify-email", verificationAttemptLimiter, verifyEmail);
router.get("/me", protect, me);
router.post(
  "/email-verification/resend",
  protect,
  verificationResendLimiter,
  resendEmailVerification
);
router.patch("/email", protect, updateEmail);
router.patch("/password", protect, updatePassword);
router.patch("/preferences", protect, updatePreferences);

export default router;
