import { Router } from "express";
import { validateRequest } from "@/middlewares/validation";
import {
    forgotPasswordSchema,
    loginSchema,
    refreshTokenSchema,
    resetPasswordSchema
}
    from "@/validations/authValidation";
import { AuthController } from "@/controllers/AuthController";
AuthController
const router = Router();
const authController = new AuthController();


// Login
router.post(
    "/login",
    validateRequest(loginSchema),
    authController.login
);

// Logout
router.post("/logout", authController.logout as any);

// Refresh token
router.post(
    "/refresh",
    validateRequest(refreshTokenSchema),
    authController.refreshToken
);

// Forgot password
router.post(
    "/forgot-password",
    validateRequest(forgotPasswordSchema),
    authController.forgotPassword
);

// Reset password
router.post(
    "/reset-password",
    validateRequest(resetPasswordSchema),
    authController.resetPassword
);

export default router;
