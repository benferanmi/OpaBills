import { Request, Response, NextFunction } from "express";
import { AuthService } from "@/services/client/AuthService";
import { AuthRequest } from "@/middlewares/auth";
import { sendSuccessResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class AuthController {
  private authService: AuthService;
  constructor() {
    this.authService = new AuthService();
  }

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.register(req.body);
      return sendSuccessResponse(
        res,
        result,
        `${result.message || "Registration successful"}`,
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.login(req.body);
      return sendSuccessResponse(res, result, "Login successful");
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const token = req.headers.authorization?.substring(7) || "";
      await this.authService.logout(userId, token);
      return sendSuccessResponse(res, null, "Logout successful");
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;
      const result = await this.authService.refreshToken(refreshToken);
      return sendSuccessResponse(res, result, "Token refreshed successfully");
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.forgotPassword(req.body);
      return sendSuccessResponse(
        res,
        null,
        "Kindly enter the otp sent to your email to reset your password"
      );
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.authService.resetPassword(req.body);
      return sendSuccessResponse(res, null, "Password reset successful");
    } catch (error) {
      next(error);
    }
  };

  verifyResetOTP = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { otp, email } = req.body;
      const result = await this.authService.verifyResetOTP(otp, email);
      return sendSuccessResponse(res, result, "OTP verified successfully");
    }
   catch (error) {
      next(error);
    }
  }
  changeAppPassword = async (
    req: AuthRequest,    
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { password, email } = req.body;
      await this.authService.changeAppPassword( password, email );
      return sendSuccessResponse(res, null, "Password changed successfully");
    } catch (error) {
      next(error);
    }
  }

  changePassword = async (
    req: AuthRequest,
    res: Response,      
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      await this.authService.changePassword({ ...req.body, userId });
      return sendSuccessResponse(res, null, "Password changed successfully");
    } catch (error) {
      next(error);
    }
  };

  verifyEmail = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { otp, email } = req.body;
      const result = await this.authService.verifyEmail(otp, email);
      return sendSuccessResponse(res, result, "Email verified successfully");
    } catch (error) {
      next(error);
    }
  };

  resendEmailVerification = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { email } = req.body;
      await this.authService.resendEmailVerification(email);
      return sendSuccessResponse(
        res,
        null,
        "Verification code resent to your email"
      );
    } catch (error) {
      next(error);
    }
  };

  sendPhoneVerification = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { phoneCode, phone } = req.body;
      await this.authService.sendPhoneVerification({
        userId,
        phoneCode,
        phone,
      });
      return sendSuccessResponse(
        res,
        null,
        "Verification code sent to your phone"
      );
    } catch (error) {
      next(error);
    }
  };

  verifyPhone = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.authService.verifyPhone({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, "Phone verified successfully");
    } catch (error) {
      next(error);
    }
  };

  updatePin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.authService.updatePin({ ...req.body, userId });
      return sendSuccessResponse(res, result, "PIN updated successfully");
    } catch (error) {
      next(error);
    }
  };

  verifyPin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const isValid = await this.authService.verifyPin({ ...req.body, userId });
      return sendSuccessResponse(
        res,
        { valid: isValid },
        isValid ? "Pin verified" : "Invalid PIN"
      );
    } catch (error) {
      next(error);
    }
  };

  setPin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { pin } = req.body;
      const result = await this.authService.setPin({ pin, userId });
      return sendSuccessResponse(res, result, "PIN set successfully");
    } catch (error) {
      next(error);
    }
  };

  toggle2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { enable } = req.body;
      const result = await this.authService.toggle2FA({ enable, userId });
      return sendSuccessResponse(
        res,
        result,
        `2FA ${enable ? "enabled" : "disabled"} successfully`
      );
    } catch (error) {
      next(error);
    }
  };

  verify2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.authService.verify2FA({ ...req.body });
      return sendSuccessResponse(res, result, "2FA verified successfully");
    } catch (error) {
      next(error);
    }
  };

  resend2FA = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      await this.authService.resend2FA(email);
      return sendSuccessResponse(res, null, "2FA code resent successfully");
    } catch (error) {
      next(error);
    }
  };
}
