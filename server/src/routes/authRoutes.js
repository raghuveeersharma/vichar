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
  requestPasswordReset,
  resetPassword,
  deleteAccount,
} from "../controllers/authControllers.js";
import protect from "../middlewear/protect.js";
import {
  loginAccountLimiter,
  loginIpLimiter,
  verificationAttemptLimiter,
  verificationResendLimiter,
  passwordResetRequestIpLimiter,
  passwordResetRequestAccountLimiter,
  passwordResetAttemptLimiter,
} from "../middlewear/authRateLimiter.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/login", loginIpLimiter, loginAccountLimiter, login);
router.post("/logout", logout);
router.post("/verify-email", verificationAttemptLimiter, verifyEmail);
router.post(
  "/password-reset/request",
  passwordResetRequestIpLimiter,
  passwordResetRequestAccountLimiter,
  requestPasswordReset
);
router.post("/password-reset/confirm", passwordResetAttemptLimiter, resetPassword);
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
router.delete("/account", protect, deleteAccount);

export default router;
