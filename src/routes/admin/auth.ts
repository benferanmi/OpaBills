import { Router } from "express";
import { validateRequest } from "@/middlewares/validation";
import {
    forgotPasswordSchema,
    loginSchema,
    refreshTokenSchema,
    resetPasswordSchema
}
    from "@/validations/admin/authValidation";
import { AuthController } from "@/controllers/admin/AuthController";
import { AdminAuthenticatedRequest } from "@/types/admin";
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
    "/password/resend",
    validateRequest(forgotPasswordSchema),
    authController.forgotPassword
);

// Reset password
router.post(
    "/password/reset",
    validateRequest(resetPasswordSchema),
    authController.resetPassword
);

router.patch(
    "/password/update",
    validateRequest(resetPasswordSchema),
    (req, res, next) =>
        authController.changePassword(req as AdminAuthenticatedRequest, res, next)
);

export default router;
