import { UserRepository } from "@/repositories/UserRepository";
import { CacheService } from "./CacheService";
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

    const profile = this.formatUserDetails(user);
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
      phone: user.phone,
      phoneCode: user.phoneCode,
      username: user.username,
      gender: user.gender,
      refCode: user.refCode,
      referredBy: user.referredBy,
      avatar: user.avatar,
      country: user.country,
      state: user.state,
      status: user.status,
      authType: user.authType,
      fcmToken: user.fcmToken,
      virtualAccount: user.virtualAccount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      loginBiometricEnabled: user.loginBiometricEnabled,
      transactionBiometricEnabled: user.transactionBiometricEnabled,
      twofactorEnabled: user.twofactorEnabled,
      // emailVerifiedAt: user.emailVerifiedAt,
      // phoneVerifiedAt: user.phoneVerifiedAt,
      // pinActivatedAt: user.pinActivatedAt,
      // twoFactorEnabledAt: user.twoFactorEnabledAt,
    };
  }
}
