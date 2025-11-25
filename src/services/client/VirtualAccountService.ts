import { VirtualAccountRepository } from "@/repositories/VirtualAccountRepository";
import { UserRepository } from "@/repositories/UserRepository";
import { SaveHavenService } from "./SaveHavenService";
import { MonnifyService } from "./MonnifyService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES, CACHE_KEYS } from "@/utils/constants";
import { Types } from "mongoose";
import { generateReference } from "@/utils/helpers";
import { CacheService } from "../CacheService";
import logger from "@/logger";

interface CreateVirtualAccountDTO {
  userId: string;
  type: "permanent" | "temporary";
  provider: string;
  identificationType: "bvn" | "nin";
  identityId: string; // From validated identity
  firstname?: string;
  lastname?: string;
  middlename?: string;
  dateOfBirth?: string;
  identificationData?: {
    bvn?: string;
    nin?: string;
  };
}

export class VirtualAccountService {
  private virtualAccountRepository: VirtualAccountRepository;
  private userRepository: UserRepository;
  private saveHavenService: SaveHavenService;
  private monnifyService: MonnifyService;
  private cacheService: CacheService;

  constructor() {
    this.virtualAccountRepository = new VirtualAccountRepository();
    this.userRepository = new UserRepository();
    this.saveHavenService = new SaveHavenService();
    this.monnifyService = new MonnifyService();
    this.cacheService = new CacheService();
  }

  /**
   * Create Virtual Account (Called after identity validation)
   * Purpose: Create SafeHaven sub-account (the real account user will use)
   * Note: Monnify account already created and saved during validation step
   */
  async createVirtualAccount(data: CreateVirtualAccountDTO) {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Get cached validation data
    const cacheKey = `${CACHE_KEYS.IDENTITY_VALIDATION}:${data.identityId}`;
    const cachedData = await this.cacheService.get(cacheKey);

    console.log(cachedData);

    if (!cachedData) {
      throw new AppError(
        "Validation session expired. Please restart verification.",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const validationData = JSON.parse(cachedData as any);

    // Verify OTP was validated
    if (!validationData.otpVerified) {
      throw new AppError(
        "OTP not verified. Please complete OTP validation first.",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Check if user already has a SafeHaven sub-account
    const existingSafeHaven = await this.virtualAccountRepository.findOne({
      userId: new Types.ObjectId(data.userId),
      provider: "savehaven",
      isActive: true,
    });

    if (existingSafeHaven) {
      logger.info(`User ${data.userId} already has SafeHaven account`);
      return existingSafeHaven;
    }

    logger.info(
      `[STEP 4] Creating SafeHaven sub-account for user ${data.userId}`
    );

    // ===
    // STEP 4: Create SafeHaven Sub-Account (Primary Account)
    // Uses verified identityId from OTP validation
    // ===
    const saveHavenAccount = await this.createSafeHavenSubAccount(
      user,
      validationData.saveHavenIdentityId
    );

    // Store SafeHaven account (PRIMARY - shown to user)
    const virtualAccount = await this.virtualAccountRepository.createAccount({
      userId: new Types.ObjectId(data.userId),
      provider: "savehaven",
      type: data.type,
      accountNumber: saveHavenAccount.account_number,
      accountName: saveHavenAccount.account_name,
      bankName: saveHavenAccount.bank_name,
      bankCode: saveHavenAccount.bank_code,
      orderReference: saveHavenAccount.reference,
      isPrimary: true, 
      isActive: true,
    });

    // ===
    // NOTE: Monnify account already saved during validation
    // No need to save it again here
    // ===
    logger.info(
      `[STEP 4] ✅ SafeHaven sub-account created (primary): ${virtualAccount.accountNumber}`
    );
    logger.info(
      `[STEP 4] ℹ️  Monnify account (validation record) already exists from Step 1`
    );

    // Update cache
    validationData.saveHavenAccountCreated = true;
    await this.cacheService.set(cacheKey, JSON.stringify(validationData), 3600);

    logger.info(
      `[STEP 4 COMPLETE] ✅ SafeHaven sub-account created for user ${data.userId}`
    );

    return virtualAccount;
  }

  /**
   * Create SafeHaven Sub-Account using verified identityId
   */
  private async createSafeHavenSubAccount(user: any, identityId: string) {
    try {
      const payload = {
        externalReference: generateReference("SAV"),
        phoneNumber: user.phone.startsWith("234")
          ? user.phone
          : "234" + user.phone,
        emailAddress: user.email,
        identityId: identityId, // Verified identityId from OTP
      };

      logger.info(
        "Creating SafeHaven sub-account:", payload
      );

      const result = await this.saveHavenService.createSubAccount(payload);

      return result;
    } catch (error: any) {
      logger.error("Error creating SafeHaven sub-account:", error);
      throw new AppError(
        error.message || "Failed to create SafeHaven sub-account",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  async getUserVirtualAccount(userId: string) {
    const account = await this.virtualAccountRepository.findOne({
      userId: new Types.ObjectId(userId),
      provider: "savehaven",
      isPrimary: true,
      isActive: true,
    });

    if (!account) {
      return null;
    }

    return {
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      provider: account.provider,
      createdAt: account.createdAt,
    };
  }

  /**
   * Get all user's virtual accounts (including hidden Monnify)
   * For admin/debugging purposes
   */
  async getAllUserVirtualAccounts(userId: string) {
    const accounts = await this.virtualAccountRepository.find({
      userId: new Types.ObjectId(userId),
      isActive: true,
    });

    return accounts.map((account) => ({
      accountNumber: account.accountNumber,
      accountName: account.accountName,
      bankName: account.bankName,
      provider: account.provider,
      isPrimary: account.isPrimary,
      createdAt: account.createdAt,
    }));
  }
  
}
