import { UserRepository } from "@/repositories/UserRepository";
import { CacheService } from "../CacheService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES, CACHE_KEYS } from "@/utils/constants";
import { IUser, IUserResponse } from "@/models/core/User";

export interface UpdateProfileDTO {
  firstname?: string;
  lastname?: string;
  phone?: string;
  phoneCode?: string;
  gender?: "male" | "female" | "other";
  country?: string;
  state?: string;
  avatar?: string;
}

export class ProfileService {
  constructor(
    private userRepository: UserRepository,
    private cacheService: CacheService
  ) {}

  async getProfile(userId: string): Promise<any> {
    // Check cache first
    // await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(userId));
    const cached = await this.cacheService.get(CACHE_KEYS.USER_PROFILE(userId));
    if (cached) {
      return cached;
    }

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const profile = await this.formatUserDetails(user);
    // Cache profile
    await this.cacheService.set(CACHE_KEYS.USER_PROFILE(userId), profile);

    return profile;
  }

  async updateProfile(userId: string, data: UpdateProfileDTO): Promise<any> {
    const user = await this.userRepository.update(userId, data);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Invalidate cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(userId));
    const userDetails = await this.formatUserDetails(user);
    if (!userDetails) {
      throw new AppError(
        "User update failed",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return { userDetails };
  }

  async toogleBiometric(
    userId: string,
    enable: boolean,
    type: "login" | "transaction"
  ): Promise<IUserResponse | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (type === "transaction") {
      user.transactionBiometricEnabled = enable;
    } else if (type === "login") {
      user.loginBiometricEnabled = enable;
    }

    // Save changes
    await user.save();

    // Invalidate cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(userId));

    const userDetails = await this.formatUserDetails(user);
    if (!userDetails) {
      throw new AppError(
        "User update failed",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    return { ...userDetails };
  }

  async deactivateAccount(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    user.status = "inactive";
    user.deletedAt = new Date();
    await user.save();

    // Invalidate cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(userId));
  }

  private async formatUserDetails(user: IUser): Promise<IUserResponse | null> {
    if (!user) return null;

    return {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      phone: user.phone || null,
      phoneCode: user.phoneCode || null,
      username: user.username || null,
      gender: user.gender || null,
      refCode: user.refCode || null,
      referredBy: user.referredBy || null,
      avatar: user.avatar || null,
      country: user.country || null,
      state: user.state || null,
      status: user.status,
      authType: user.authType,
      fcmTokens: user.fcmTokens,
      virtualAccount: user.virtualAccount || null,
      dateOfBirth: user.dateOfBirth || null,
      bvnVerified: user.bvnVerified,
      bvnValidated: user.bvnValidated,
      loginBiometricEnabled: user.loginBiometricEnabled || false,
      transactionBiometricEnabled: user.transactionBiometricEnabled || false,
      twofactorEnabled: user.twofactorEnabled || false,
      emailVerifiedAt: user.emailVerifiedAt || null,
      phoneVerifiedAt: user.phoneVerifiedAt || null,
      pinActivatedAt: user.pinActivatedAt || null,
      twoFactorEnabledAt: user.twoFactorEnabledAt || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
