import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { ProfileService } from "@/services/ProfileService";
import { sendSuccessResponse } from "@/utils/helpers";

export class ProfileController {
  constructor(private profileService: ProfileService) {}

  getProfile = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const profile = await this.profileService.getProfile(userId);
      return sendSuccessResponse(
        res,
        profile,
        "Profile retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const profile = await this.profileService.updateProfile(userId, req.body);
      return sendSuccessResponse(res, profile, "Profile updated successfully");
    } catch (error) {
      next(error);
    }
  };

  toogleBiometric = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { enable, type } = req.body;
      const result = await this.profileService.toogleBiometric(
        userId,
        enable,
        type
      );
      let message;

      if (type === "login") {
        message = enable
          ? "Login biometric authentication enabled"
          : "Login biometric authentication disabled";
      } else if (type === "transaction") {
        message = enable
          ? "Transaction biometric authentication enabled"
          : "Transaction biometric authentication disabled";
      } else {
        message = "Biometric authentication setting updated";
      }
      return sendSuccessResponse(res, result, message);
    } catch (error) {
      next(error);
    }
  };

  deactivateAccount = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      await this.profileService.deactivateAccount(userId);
      return sendSuccessResponse(
        res,
        null,
        "Account deactivated successfully"
      );
    } catch (error) {
      next(error);
    }
  }
}
