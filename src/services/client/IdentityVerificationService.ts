import { WalletRepository } from "@/repositories/WalletRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { UserRepository } from "@/repositories/UserRepository";
import { VirtualAccountRepository } from "@/repositories/VirtualAccountRepository";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES, CACHE_KEYS } from "@/utils/constants";
import { Types } from "mongoose";
import { generateReference } from "@/utils/helpers";
import { CacheService } from "../CacheService";
import { SaveHavenService } from "./SaveHavenService";
import { MonnifyService } from "./MonnifyService";
import logger from "@/logger";

interface ValidationData {
  firstname: string;
  lastname: string;
  dateOfBirth: string;
  identificationType: "bvn" | "nin";
  value: string;
  middlename?: string;
  phoneNumber?: string;
}

interface ValidationResponse {
  success: boolean;
  identityId?: string;
  message: string;
  step: "bvn_validated" | "otp_sent";
  data?: any;
}

export class IdentityVerificationService {
  private walletRepository: WalletRepository;
  private cacheService: CacheService;
  private transactionRepository: TransactionRepository;
  private userRepository: UserRepository;
  private virtualAccountRepository: VirtualAccountRepository;
  private notificationRepository?: NotificationRepository;
  private saveHavenService: SaveHavenService;
  private monnifyService: MonnifyService;

  constructor() {
    this.walletRepository = new WalletRepository();
    this.cacheService = new CacheService();
    this.transactionRepository = new TransactionRepository();
    this.userRepository = new UserRepository();
    this.virtualAccountRepository = new VirtualAccountRepository();
    this.monnifyService = new MonnifyService();
    this.saveHavenService = new SaveHavenService();
  }

  async validateIdentity(
    userId: string | Types.ObjectId,
    data: ValidationData
  ): Promise<ValidationResponse> {
    try {
      const user = await this.userRepository.findById(userId.toString());
      if (!user) {
        throw new AppError(
          "User not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      logger.info(
        `[FLOW START] Starting BVN/NIN validation for user ${userId}`
      );

      // STEP 0: Checking if user already has SafeHaven account
      const existingSafeHavenAccount =
        await this.virtualAccountRepository.findOne({
          userId: new Types.ObjectId(userId.toString()),
          provider: "saveHaven",
          isActive: true,
        });

      if (existingSafeHavenAccount) {
        logger.info(
          `[STEP 0] User ${userId} already has SafeHaven account: ${existingSafeHavenAccount.accountNumber}. No need to create again.`
        );

        throw new AppError(
          "You already have a SafeHaven virtual account.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // STEP 1: Validate BVN/NIN with Monnify (if not already validated)
      // Purpose: Confirm BVN/NIN details are correct
      let monnifyAccount;
      let shouldSaveMonnify = false;

      if (user.bvnValidated && data.identificationType === "bvn") {
        logger.info(
          `User ${userId} BVN already validated. Skipping Monnify validation.`
        );

        // Get existing Monnify account details from database
        const existingMonnifyAccount =
          await this.virtualAccountRepository.findOne({
            userId: new Types.ObjectId(userId.toString()),
            provider: "monnify",
          });

        if (existingMonnifyAccount) {
          monnifyAccount = {
            accountReference: existingMonnifyAccount.orderReference,
            accountName: existingMonnifyAccount.accountName,
            customerName:
              existingMonnifyAccount.customerName ||
              `${data.firstname} ${data.lastname}`,
            accounts: [
              {
                accountNumber: existingMonnifyAccount.accountNumber,
                bankName: existingMonnifyAccount.bankName,
                bankCode: existingMonnifyAccount.bankCode,
              },
            ],
          };
        } else {
          // Edge case: bvnValidated=true but no Monnify record
          logger.warn(
            ` User has bvnValidated=true but no Monnify record. Creating one...`
          );
          monnifyAccount = await this.validateBVNWithMonnify(user, data);
          shouldSaveMonnify = true;
        }
      } else {
        logger.info(`Validating BVN/NIN with Monnify...`);
        monnifyAccount = await this.validateBVNWithMonnify(user, data);
        shouldSaveMonnify = true;

        logger.info(
          `Monnify validation successful: ${monnifyAccount.accountReference}`
        );
      }

      // STEP 1.1: Save Monnify Account to Database
      if (shouldSaveMonnify) {
        logger.info(
          "Saving Monnify account to database (for validation records only)..."
        );

        const savedMonnifyAccount =
          await this.virtualAccountRepository.createAccount({
            userId: userId as Types.ObjectId,
            provider: "monnify",
            type: "permanent",
            customerName: monnifyAccount.customerName,
            accountName: monnifyAccount.accounts[0].accountName,
            accountNumber: monnifyAccount.accounts[0].accountNumber,
            bankName: monnifyAccount.accounts[0].bankName,
            bankCode: monnifyAccount.accounts[0].bankCode,
            orderReference: monnifyAccount.accountReference,
            isPrimary: false,
            isActive: true,
          });

        logger.info(
          `Monnify account saved (validation record): ${savedMonnifyAccount.accountNumber}`
        );

        // Update User with BVN and Validation Status
        logger.info("Updating user with BVN and validation status...");

        if (data.identificationType === "bvn") {
          user.bvn = data.value;
          user.bvnValidated = true;
          await user.save();
          logger.info(
            `User ${userId} updated: BVN = ${data.value}, bvnValidated = true`
          );
        } else if (data.identificationType === "nin") {
          user.nin = data.value;
          // TOCHECK: user.ninValidated = true

          await user.save();
          logger.info(`User ${userId} updated: NIN = ${data.value}`);
        }
      }

      // STEP 2: Send OTP via SafeHaven (if not already verified)
      let identityId: string;
      let otpAlreadySent = false;

      if (user.bvnVerified && data.identificationType === "bvn") {
        logger.info(
          `User ${userId} BVN already verified (OTP confirmed). Skipping OTP send.`
        );

        throw new AppError(
          "Your BVN is already verified. Please proceed to create your virtual account.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      } else {
        logger.info(`Initiating SafeHaven identity verification (OTP)...`);

        const saveHavenOTP =
          await this.saveHavenService.initiateIdentityVerification({
            identityType: data.identificationType,
            identityNumber: data.value,
            firstName: data.firstname,
            lastName: data.lastname,
            middleName: data.middlename,
            dateOfBirth: data.dateOfBirth,
          });

        identityId = saveHavenOTP.identityId;
        otpAlreadySent = true;

        logger.info(`OTP sent via SafeHaven, identityId: ${identityId}`);
      }

      // Store validation data in cache
      const cacheKey = `${CACHE_KEYS.IDENTITY_VALIDATION}:${identityId}`;

      const cacheData = {
        userId: userId.toString(),
        identificationType: data.identificationType,
        identificationValue: data.value,
        firstname: data.firstname,
        lastname: data.lastname,
        dateOfBirth: data.dateOfBirth,
        middlename: data.middlename,
        phoneNumber: data.phoneNumber,
        email: user.email,
        //Monnify
        monnifyAccountReference: monnifyAccount.accountReference,
        monnifyAccountNumber: monnifyAccount.accounts[0]?.accountNumber,
        monnifyAccountName: monnifyAccount.accountName,
        monnifyBankName: monnifyAccount.accounts[0]?.bankName,
        monnifyBankCode: monnifyAccount.accounts[0]?.bankCode,

        // SafeHaven identity data
        saveHavenIdentityId: identityId,

        // Validation status flags
        bvnValidatedWithMonnify: shouldSaveMonnify,
        monnifyAccountSavedToDatabase: shouldSaveMonnify,
        otpSent: otpAlreadySent,
        otpVerified: false,
        saveHavenAccountCreated: false,

        // Metadata
        timestamp: Date.now(),
      };

      await this.cacheService.set(cacheKey, JSON.stringify(cacheData), 3600);

      logger.info(
        `Flow completed:
      - BVN validated: ${user.bvnValidated}
      - Monnify saved: ${shouldSaveMonnify}
      - OTP sent: ${otpAlreadySent}
      - Awaiting OTP verification...`
      );

      return {
        success: true,
        identityId: identityId,
        message:
          "BVN/NIN validated successfully. An OTP has been sent to your registered phone number. ",
        step: "otp_sent",
        data: {
          bvnValidated: user.bvnValidated,
          monnifyAccountCreated: shouldSaveMonnify,
          monnifyAccountSaved: shouldSaveMonnify,
          otpSent: otpAlreadySent,
          expiresIn: 3600,
          nextStep: "Verify the OTP to complete your account setup",
        },
      };
    } catch (error: any) {
      logger.error("[Step 1/2] Validation initiation failed:", {
        error: error.message,
        stack: error.stack,
      });

      if (error instanceof AppError) {
        throw error;
      }

      const errorMessage = error.message || "";

      if (errorMessage.toLowerCase().includes("bvn")) {
        throw new AppError(
          "BVN validation failed. Please verify your BVN details are correct.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (errorMessage.toLowerCase().includes("nin")) {
        throw new AppError(
          "NIN validation failed. Please verify your NIN details are correct.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (errorMessage.toLowerCase().includes("already exists")) {
        throw new AppError(
          "An account with this BVN/NIN already exists.",
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      throw new AppError(
        errorMessage || "Identity validation failed",
        error.statusCode || HTTP_STATUS.BAD_REQUEST,
        error.code || ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Validate BVN/NIN by creating Monnify account
  // Monnify performs internal KYC validation during account creation
  private async validateBVNWithMonnify(
    user: any,
    data: ValidationData
  ): Promise<any> {
    try {
      logger.info(
        `Creating Monnify account to validate ${data.identificationType.toUpperCase()}: ${
          data.value
        }`
      );

      const reference = generateReference("MVAL");

      const payload: any = {
        email: user.email,
        firstname: data.firstname,
        lastname: data.lastname,
        reference: reference,
        getAllBanks: true,
      };

      // Add BVN or NIN
      if (data.identificationType === "bvn") {
        payload.bvn = data.value;
      } else {
        payload.nin = data.value;
      }

      const monnifyAccount = await this.monnifyService.createVirtualAccount(
        payload
      );

      logger.info(
        `Monnify account created (BVN/NIN validated): ${monnifyAccount.accountReference}`
      );

      return monnifyAccount;
    } catch (error: any) {
      logger.error("Monnify BVN/NIN validation failed:", {
        error: error.message,
        response: error.response?.data,
      });

      const errorMessage =
        error.response?.data?.responseMessage ||
        error.response?.data?.message ||
        error.message;

      if (errorMessage?.toLowerCase().includes("bvn")) {
        throw new AppError(
          "Invalid BVN. Please check your BVN and try again.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (errorMessage?.toLowerCase().includes("nin")) {
        throw new AppError(
          "Invalid NIN. Please check your NIN and try again.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (errorMessage?.toLowerCase().includes("already exists")) {
        throw new AppError(
          "An account already exists with this BVN/NIN.",
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (errorMessage?.toLowerCase().includes("name mismatch")) {
        throw new AppError(
          "Name does not match BVN/NIN records. Please verify your details.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      throw new AppError(
        errorMessage || "BVN/NIN validation failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // STEP 3: Validate OTP
  async validateOtp(
    identityId: string,
    identificationType: string,
    otp: string
  ): Promise<{
    success: boolean;
    message: string;
    data: any;
  }> {
    try {
      // Get cached validation data
      const cacheKey = `${CACHE_KEYS.IDENTITY_VALIDATION}:${identityId}`;
      const cachedData = await this.cacheService.get(cacheKey);
      if (!cachedData) {
        throw new AppError(
          "Validation session expired or not found. Please restart the verification process.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const validationData = JSON.parse(cachedData as any);

      if (!otp || otp.trim().length === 0) {
        throw new AppError(
          "OTP is required",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`[STEP 3] Validating OTP for identity ${identityId}`);

      // Validate OTP with SaveHaven
      const result = await this.saveHavenService.validateIdentity({
        identityId: identityId,
        identificationType: identificationType.toUpperCase(),
        otp: otp.trim(),
      });

      if (!result.verified) {
        throw new AppError(
          "Invalid OTP. Please check and try again.",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(` OTP validated successfully`);

      // Update user with BVN/NIN verification status
      const user = await this.userRepository.findById(validationData.userId);
      if (!user) {
        throw new AppError(
          "User not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      if (validationData.identificationType === "bvn") {
        user.bvnVerified = true;
        await user.save();
      } else if (validationData.identificationType === "nin") {
        // TOCHECK: user.ninVerified = true
        await user.save();
      }

      logger.info(
        `[STEP 3] ✅ User ${validationData.userId} identity verified and ownership confirmed`
      );

      // Update cache to mark OTP as verified
      const updatedCacheData = {
        ...validationData,
        otpVerified: true,
        verifiedAt: Date.now(),
      };

      await this.cacheService.set(
        cacheKey,
        JSON.stringify(updatedCacheData),
        3600 // Keep for sub-account creation
      );

      return {
        success: true,
        message:
          "Identity verified successfully! You can now create your SafeHaven virtual account.",
        data: {
          identityId: identityId,
          userId: validationData.userId,
          identificationType: validationData.identificationType,
          otpVerified: true,
          canCreateSubAccount: true,
        },
      };
    } catch (error: any) {
      logger.error("OTP validation error:", {
        error: error.message,
        identityId,
      });

      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        "OTP validation failed. Please try again.",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Get validation status
  async getValidationStatus(identityId: string): Promise<any> {
    try {
      const cacheKey = `${CACHE_KEYS.IDENTITY_VALIDATION}:${identityId}`;
      const cachedData = await this.cacheService.get(cacheKey);

      if (!cachedData) {
        return {
          exists: false,
          message: "Validation session not found or expired",
        };
      }

      const validationData = JSON.parse(cachedData as any);

      return {
        exists: true,
        identificationType: validationData.identificationType,
        bvnValidatedWithMonnify:
          validationData.bvnValidatedWithMonnify || false,
        otpSent: validationData.otpSent || false,
        otpVerified: validationData.otpVerified || false,
        saveHavenAccountCreated:
          validationData.saveHavenAccountCreated || false,
        canCreateSubAccount: validationData.otpVerified === true,
        timestamp: validationData.timestamp,
        expiresAt: validationData.timestamp + 3600000,
      };
    } catch (error: any) {
      logger.error("Error getting validation status:", error);
      throw new AppError(
        "Failed to get validation status",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }
}
