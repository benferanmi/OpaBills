import { NextFunction, Request, Response } from "express";
import { AuthService } from "@/services/admin/authService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";
import logger from "@/logger";
import { AdminAuthenticatedRequest } from "@/types/admin/index";

export class AuthController {
    private authService = new AuthService();

    login = async (req: Request, res: Response): Promise<void> => {
        try {
            console.log('got here')
            const result = await this.authService.login(
                req.body,
                req.ip,
                req.get("User-Agent")
            );
            logger.info("Admin login successful", {
                adminId: result.admin.id,
                ip: req.ip,
            });
            sendSuccessResponse(res, result, "Login successful");
        } catch (error: any) {
            logger.error("Admin login failed", {
                error: error.message,
                email: req.body.email,
                ip: req.ip,
            });
            sendErrorResponse(
                res,
                error.message,
                error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    };

    logout = async (
        req: AdminAuthenticatedRequest,
        res: Response
    ): Promise<void> => {
        try {
            await this.authService.logout(req.get("Authorization"));
            logger.info("Admin logout successful", { adminId: req.admin?.adminId });
            sendSuccessResponse(res, {}, "Logout successful");
        } catch (error: any) {
            logger.error("Admin logout failed", { error: error.message });
            sendErrorResponse(
                res,
                error.message,
                error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    };

    refreshToken = async (req: Request, res: Response): Promise<void> => {
        try {
            const result = await this.authService.refreshToken(req.body.refreshToken);
            sendSuccessResponse(res, result, "Token refreshed successfully");
        } catch (error: any) {
            logger.error("Admin token refresh failed", { error: error.message });
            sendErrorResponse(
                res,
                error.message,
                error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    };

    forgotPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.authService.forgotPassword(req.body.email);
            sendSuccessResponse(res, "Password reset OTP sent successfully");
        } catch (error: any) {
            logger.error("Admin forgot password failed", { error: error.message });
            sendErrorResponse(
                res,
                error.message,
                error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    };

    resetPassword = async (req: Request, res: Response): Promise<void> => {
        try {
            await this.authService.verifyOtpAndResetPassword(req.body);
            logger.info("Admin password reset successful", { email: req.body.email });
            sendSuccessResponse(res, "Password reset successful");
        } catch (error: any) {
            logger.error("Admin password reset failed", { error: error.message });
            sendErrorResponse(
                res,
                error.message,
                error.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
            );
        }
    };

    getProfile = async (
        req: AdminAuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) => {
        try {
            console.log(req.admin);
            const adminId = req.admin?.id;

            if (!adminId) {
                sendErrorResponse(
                    res,
                    "You have to be authenticated to make this request",
                    HTTP_STATUS.UNAUTHORIZED
                );
                return;
            }

            const profile = await this.authService.fetchProfile(adminId);

            sendSuccessResponse(res, profile, "Profile fetched Successfully");
        } catch (error: any) {
            logger.error("Failed to fetch Admin profile", {
                message: error.message,
                adminId: req.admin?.id,
            });
            next();
        }
    };

    async changePassword(
        req: AdminAuthenticatedRequest,
        res: Response,
        next: NextFunction
    ) {
        try {
            const adminId = req.admin?.adminId;
            if (!adminId) {
                sendErrorResponse(
                    res,
                    "Admin not authenticated",
                    HTTP_STATUS.UNAUTHORIZED
                );
                return;
            }
            const { newPassword, currentPassword } = req.body;

            const result = await this.authService.changePassword(
                adminId,
                newPassword,
                currentPassword
            );

            sendSuccessResponse(res, null, "Password changed successfully");
        } catch (error: any) {
            logger.error("Error changing admin password", {
                message: error.message,
                adminId: req.admin?.adminId,
                adminEmail: req.admin?.email,
            });
            next(error);
        }
    }
}
