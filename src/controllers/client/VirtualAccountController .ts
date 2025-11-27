import { Request, Response, NextFunction } from "express";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { sendSuccessResponse } from "@/utils/helpers";
import { IdentityVerificationService } from "@/services/client/IdentityVerificationService";
import { VirtualAccountService } from "@/services/client/VirtualAccountService";
import logger from "@/logger";

interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    [key: string]: any;
  };
}

export class VirtualAccountController {
  private identityVerificationService: IdentityVerificationService;
  private virtualAccountService: VirtualAccountService;

  constructor() {
    this.identityVerificationService = new IdentityVerificationService();
    this.virtualAccountService = new VirtualAccountService();
  }

  initiateVirtualAccountGeneration = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const {
        identificationType,
        value,
        firstname,
        lastname,
        middlename,
        dateOfBirth,
        phoneNumber,
      } = req.body;

      // Validate identificationType
      const normalizedType = identificationType.toLowerCase();

      logger.info(
        `[Step 1] Initiating validation for user ${userId}, type: ${normalizedType}`
      );

      //  Validate with Monnify (BVN/NIN check) then send OTP via SaveHaven
      const result = await this.identityVerificationService.validateIdentity(
        userId,
        {
          identificationType: normalizedType as "bvn" | "nin",
          value,
          firstname,
          lastname,
          middlename,
          dateOfBirth,
          phoneNumber,
        }
      );

      logger.info(
        `[Step 1] ✅ Validation initiated successfully for user ${userId}`
      );

      return sendSuccessResponse(
        res,
        {
          identityId: result.identityId,
          step: result.step,
          expiresIn: 3600,
          nextStep: "Verify the OTP sent to your phone to continue",
        },
        result.message
      );
    } catch (error) {
      logger.error("[Step 1] Validation initiation failed:", error);
      next(error);
    }
  };

  verifyOTPAndCreateAccount = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const {
        identityId,
        otp,
        type = "permanent",
        identificationType,
      } = req.body;

      logger.info(
        `[Step 2] Validating OTP for user ${userId}, identityId: ${identityId}`
      );

      //  Validate OTP
      const validation = await this.identityVerificationService.validateOtp(
        identityId.trim(),
        identificationType,
        otp
      );

      if (!validation.success) {
        throw new AppError(
          validation.message || "OTP validation failed",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Creating virtual account for user ${userId}`);

      // Create virtual account using validated identityId
      const virtualAccount =
        await this.virtualAccountService.createVirtualAccount({
          userId,
          type,
          provider: "saveHaven",
          identificationType: "bvn",
          identityId: identityId.trim(),
        });

      logger.info(` Virtual account created successfully for user ${userId}`);

      return sendSuccessResponse(
        res,
        {
          verified: true,
          account: virtualAccount,
        },
        "Identity verified and virtual account created successfully!"
      );
    } catch (error) {
      logger.error(
        "[Step 2/3] OTP verification or account creation failed:",
        error
      );
      next(error);
    }
  };

  // Get user's primary virtual account
  getUserVirtualAccount = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;

      const account = await this.virtualAccountService.getUserVirtualAccount(
        userId
      );

      if (!account) {
        return sendSuccessResponse(
          res,
          { hasAccount: false },
          "No virtual account found. Please create one."
        );
      }

      return sendSuccessResponse(
        res,
        { hasAccount: true, account },
        "Virtual account retrieved successfully"
      );
    } catch (error) {
      logger.error("Error retrieving virtual account:", error);
      next(error);
    }
  };

  // Get validation status (check if OTP session is still valid)
  getValidationStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { identityId } = req.params;

      if (!identityId || !identityId.trim()) {
        throw new AppError(
          "identityId is required",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const status = await this.identityVerificationService.getValidationStatus(
        identityId.trim()
      );

      return sendSuccessResponse(
        res,
        status,
        status.exists
          ? "Validation status retrieved successfully"
          : "Validation session not found"
      );
    } catch (error) {
      logger.error("Error retrieving validation status:", error);
      next(error);
    }
  };

  resendOTP = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { identityId } = req.body;

      if (!identityId || !identityId.trim()) {
        throw new AppError(
          "identityId is required",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Check if session still exists
      const status = await this.identityVerificationService.getValidationStatus(
        identityId.trim()
      );

      if (!status.exists) {
        throw new AppError(
          "Validation session expired. Please restart the verification process.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (status.verified) {
        throw new AppError(
          "Identity already verified. You can now create your virtual account.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // TODO: call SafeHaven's resend OTP endpoint
      // For now, informing user to restart the process
      throw new AppError(
        "OTP resend not yet implemented. Please restart the verification process if OTP expired.",
        HTTP_STATUS.NOT_IMPLEMENTED,
        ERROR_CODES.NOT_IMPLEMENTED
      );
    } catch (error) {
      logger.error("Error resending OTP:", error);
      next(error);
    }
  };
}
