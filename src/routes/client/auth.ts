import { Router } from "express";
import { AuthController } from "@/controllers/client/AuthController";

import { authenticate } from "@/middlewares/auth";
import { validateRequest } from "@/middlewares/validation";
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  verifyOTPSchema,
  updatePinSchema,
  verifyPinSchema,
  refreshTokenSchema,
  phoneNumberVerificationSchema,
  setPinSchema,
  toggle2FASchema,
  verifyOTPAppSchema,
  changeAppPasswordSchema,
  changePinSchema,
} from "@/validations/client/authValidation";

const router = Router();

const authController = new AuthController();

// Public routes
router.post(
  "/register",
  validateRequest(registerSchema),
  authController.register
);
router.post("/login", validateRequest(loginSchema), authController.login);
router.post(
  "/refresh-token",
  validateRequest(refreshTokenSchema),
  authController.refreshToken
);
router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  authController.forgotPassword
);
router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  authController.resetPassword
);

// reset password for app 
router.post("/verify-reset-otp", validateRequest(verifyOTPAppSchema), authController.verifyResetOTP);

router.post("/change-app-password", validateRequest(changeAppPasswordSchema), authController.changeAppPassword);

// Protected routes
router.post("/logout", authenticate, authController.logout);
router.post(
  "/change-password",
  authenticate,
  validateRequest(changePasswordSchema),
  authController.changePassword
);

// Email verification after login
router.post("/email/resend", authController.resendEmailVerification);
router.post(
  "/email/verify",
  validateRequest(verifyOTPSchema),
  authController.verifyEmail
);

// Phone verification
router.post(
  "/phone/resend",
  authenticate,
  validateRequest(phoneNumberVerificationSchema),
  authController.sendPhoneVerification
);
router.post(
  "/phone/verify",
  authenticate,
  validateRequest(verifyOTPSchema),
  authController.verifyPhone
);

// PIN management
router.put(
  "/pin/set",
  authenticate,
  validateRequest(setPinSchema),
  authController.setPin
);

router.put(
  "/pin/update",
  authenticate,
  validateRequest(updatePinSchema),
  authController.updatePin
);

router.put(
  "/pin/change",
  authenticate,
  validateRequest(changePinSchema),
  authController.changePin
);

router.post(
  "/pin/verify",
  authenticate,
  validateRequest(verifyPinSchema),
  authController.verifyPin
);

// 2FA management
router.post(
  "/2fa/toggle",
  authenticate,
  validateRequest(toggle2FASchema),
  authController.toggle2FA
);
router.post(
  "/2fa/verify",
  validateRequest(verifyOTPSchema),
  authController.verify2FA
);

router.post("/2fa/resend", authController.resend2FA);

export default router;
