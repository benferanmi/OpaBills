import { UserRepository } from "@/repositories/UserRepository";
import { EmailService } from "../EmailService";
import { SMSService } from "../SMSService";
import { hashPassword, comparePassword } from "@/utils/cryptography";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "@/config/jwt";
import { generateRefCode } from "@/utils/helpers";
import { AppError } from "@/middlewares/errorHandler";
import {
  HTTP_STATUS,
  ERROR_CODES,
  CACHE_KEYS,
  CACHE_TTL,
} from "@/utils/constants";
import { IUser, IUserResponse, User } from "@/models/core/User";
import { Types } from "mongoose";
import { WalletRepository } from "@/repositories/WalletRepository";
import { CacheService } from "../CacheService";
import { OTPService } from "../OTPService";

export interface RegisterDTO {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  phone?: string;
  phoneCode?: string;
  username?: string;
  referralCode?: string;
}

export interface LoginDTO {
  email: string;
  password: string;
  fcmToken?: string;
}

export interface ForgotPasswordDTO {
  email: string;
}

export interface ResetPasswordDTO {
  otp: string;
  password: string;
  gmail: string;
}

export interface ChangePasswordDTO {
  userId: string;
  oldPassword: string;
  newPassword: string;
}

export interface VerifyPhoneDTO {
  userId: string;
  otp: string;
}

export interface SendPhoneVerificationDTO {
  userId: string;
  phoneCode: string;
  phone: string;
}

export interface UpdatePinDTO {
  userId: string;
  pin: string;
  password: string;
}

export interface VerifyPinDTO {
  userId: string;
  pin: string;
}

export interface Toggle2FADTO {
  userId: string;
  enable: boolean;
}

export interface Verify2FADTO {
  email: string;
  otp: string;
}

export interface SetPinDTO {
  pin: string;
  userId: string;
}

export interface AuthResponseDTO {
  user: IUserResponse | null;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private otpService: OTPService;
  private emailService: EmailService;
  private smsService: SMSService;
  private userRepository: UserRepository;
  private walletRepository: WalletRepository;
  private cacheService: CacheService;
  constructor() {
    this.otpService = new OTPService();
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.userRepository = new UserRepository();
    this.walletRepository = new WalletRepository();
    this.cacheService = new CacheService();
  }

  async register(data: RegisterDTO): Promise<any> {
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new AppError(
        "Email already exists",
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.DUPLICATE_ENTRY
      );
    }

    // Check if username exists already
    if (data.username) {
      const existingUsername = await this.userRepository.findByUsername(
        data.username
      );
      if (existingUsername) {
        throw new AppError(
          "Username already exists",
          HTTP_STATUS.CONFLICT,
          ERROR_CODES.DUPLICATE_ENTRY
        );
      }
    }

    // Validate referral code if provided
    let referrerId = undefined;
    if (data.referralCode) {
      const referrer = await this.userRepository.findByRefCode(
        data.referralCode
      );
      if (referrer) {
        referrerId = referrer._id as Types.ObjectId;
      }
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Generate unique refCode
    let refCode = generateRefCode();
    while (await this.userRepository.findByRefCode(refCode)) {
      refCode = generateRefCode();
    }

    // Create user
    const user = await this.userRepository.create({
      ...data,
      password: hashedPassword,
      refCode,
      referredBy: referrerId,
    });

    // Create main wallet
    await this.walletRepository.create({
      userId: user._id as Types.ObjectId,
      type: "main",
      balance: 0,
    });

    // Send email verification OTP automatically
    const otp = await this.otpService.generateAndStore(
      user.id.toString(),
      "email_verification"
    );
    await this.emailService.sendVerificationEmail(
      user.email,
      otp,
      user.firstname
    );

    // Generate tokens
    // const accessToken = generateAccessToken({
    //   id: user.id.toString(),
    //   email: user.email,
    // });
    // const refreshToken = generateRefreshToken({
    //   id: user.id.toString(),
    //   email: user.email,
    // });

    return {
      // user: {
      //   id: user._id,
      //   firstname: user.firstname,
      //   lastname: user.lastname,
      //   email: user.email,
      //   username: user.username,
      //   refCode: user.refCode,
      //   emailVerified: false,
      // },
      // accessToken,
      // refreshToken,
      message:
        "Registration successful. Please check your email for verification code.",
    };
  }

  async login(data: LoginDTO): Promise<any> {
    // Find user
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError(
        "Invalid credentials",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    // Check if email is verified
    if (!user.emailVerifiedAt) {
      await this.resendEmailVerification(user.email);
      throw new AppError(
        "Please verify your email before logging in",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.EMAIL_NOT_VERIFIED
      );
    }

    if (user.twoFactorEnabledAt || user.twofactorEnabled) {
      const otp = await this.otpService.generateAndStore(
        user.id.toString(),
        "2fa"
      );

      await this.emailService.send2FAEmail(user.email, otp, user.firstname);

      throw new AppError(
        "2FA code sent. Please verify to complete login.",
        HTTP_STATUS.OK,
        ERROR_CODES.TWO_FA_REQUIRED
      );
    }

    // Check if account is suspended
    if (user.status === "suspended") {
      throw new AppError(
        "Account is suspended",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.ACCOUNT_SUSPENDED
      );
    }

    // Check if account is inactive
    if (user.status === "inactive") {
      throw new AppError(
        "Account is inactive",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.ACCOUNT_INACTIVE
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        "Invalid credentials",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    if (data.fcmToken && !user.fcmTokens.includes(data.fcmToken)) {
      user.fcmTokens.push(data.fcmToken);
      await user.save();
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id.toString(),
      email: user.email,
    });
    const refreshToken = generateRefreshToken({
      id: user.id.toString(),
      email: user.email,
    });

    const formattedUser = await this.formatUserDetails(user);

    return {
      user: formattedUser,
      accessToken,
      refreshToken,
    };
  }

  async logout(
    userId: string,
    token: string,
    fcmToken?: string
  ): Promise<void> {
    // Blacklist the token
    await this.cacheService.set(
      CACHE_KEYS.TOKEN_BLACKLIST(token),
      "true",
      CACHE_TTL.ONE_DAY
    );

    // Clear user cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(userId));

    if (fcmToken) {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        throw new AppError(
          "User not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      user.fcmTokens = user.fcmTokens.filter((t) => t !== fcmToken);
      await user.save();
    }
  }

  async refreshToken(refreshToken: string): Promise<any> {
    try {
      const decoded = verifyRefreshToken(refreshToken);

      const user = await this.userRepository.findById(decoded.id);
      if (!user) {
        throw new AppError(
          "User not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      if (user.status !== "active") {
        throw new AppError(
          "Account is not active",
          HTTP_STATUS.FORBIDDEN,
          ERROR_CODES.ACCOUNT_INACTIVE
        );
      }

      const accessToken = generateAccessToken({
        id: user.id.toString(),
        email: user.email,
      });
      const newRefreshToken = generateRefreshToken({
        id: user.id.toString(),
        email: user.email,
      });

      return {
        accessToken,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new AppError(
        "Invalid refresh token",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }
  }

  async forgotPassword(data: ForgotPasswordDTO): Promise<void> {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      return;
    }

    const otp = await this.otpService.generateAndStore(
      user.id.toString(),
      "forgot_password"
    );
    await this.emailService.sendForgotPasswordEmail(
      user.email,
      otp,
      user.firstname
    );

    return;
  }

  async resetPassword(data: ResetPasswordDTO): Promise<void> {
    const user = await this.userRepository.findByEmail(data.gmail);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Verify OTP from Redis
    const isValid = await this.otpService.verify(
      user.id.toString(),
      "forgot_password",
      data.otp
    );
    if (!isValid) {
      throw new AppError(
        "Invalid or expired OTP",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    const hashedPassword = await hashPassword(data.password);
    await this.userRepository.updatePassword(user.email, hashedPassword);

    return;
  }

  async changePassword(data: ChangePasswordDTO): Promise<void> {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const isPasswordValid = await comparePassword(
      data.oldPassword,
      user.password
    );
    if (!isPasswordValid) {
      throw new AppError(
        "Invalid Credentials",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    const hashedPassword = await hashPassword(data.newPassword);
    await this.userRepository.updatePassword(data.userId, hashedPassword);

    // Clear user cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(data.userId));
  }

  async verifyEmail(
    otp: string,
    email: string
  ): Promise<AuthResponseDTO | null> {
    console.log(email);
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (user.emailVerifiedAt) {
      throw new AppError(
        "Email already verified",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Verify OTP from Redis
    const isValid = await this.otpService.verify(
      user.id.toString(),
      "email_verification",
      otp
    );
    if (!isValid) {
      throw new AppError(
        "Invalid or expired OTP",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    // Mark email as verified
    await this.userRepository.verifyEmail(user.id.toString());

    const data = await this.formatUserDetails(user);
    const accessToken = generateAccessToken({
      id: user.id.toString(),
      email: user.email,
    });
    const refreshToken = generateRefreshToken({
      id: user.id.toString(),
      email: user.email,
    });

    // Clear user cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(user.id.toString()));

    return { user: data, accessToken, refreshToken };
  }

  async resendEmailVerification(email: string): Promise<void> {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (user.emailVerifiedAt) {
      throw new AppError(
        "Email already verified",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Generate and store OTP in Redis
    const otp = await this.otpService.generateAndStore(
      user.id.toString(),
      "email_verification"
    );

    // Send verification email
    await this.emailService.sendVerificationEmail(
      user.email,
      otp,
      user.firstname
    );

    // Clear user cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(user.id.toString()));

    return;
  }

  async sendPhoneVerification(data: SendPhoneVerificationDTO): Promise<void> {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (user.phoneVerifiedAt) {
      throw new AppError(
        "Phone already verified",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    user.phoneCode = data.phoneCode;
    user.phone = data.phone;
    await user.save();

    // Generate and store OTP in Redis
    const otp = await this.otpService.generateAndStore(
      data.userId.toString(),
      "phone_verification"
    );

    // Send SMS via Termii
    const fullPhone = `${user.phoneCode || ""}${user.phone}`;
    await this.smsService.sendPhoneVerificationOTP(fullPhone, otp);
  }

  async verifyPhone(data: VerifyPhoneDTO): Promise<void> {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (user.phoneVerifiedAt) {
      throw new AppError(
        "Phone already verified",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Verify OTP from Redis
    const isValid = await this.otpService.verify(
      data.userId,
      "phone_verification",
      data.otp
    );
    if (!isValid) {
      throw new AppError(
        "Invalid or expired OTP",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    // Mark phone as verified
    await this.userRepository.verifyPhone(data.userId);
  }

  async updatePin(data: UpdatePinDTO): Promise<void> {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Verify password
    const isPasswordValid = await comparePassword(data.password, user.password);
    if (!isPasswordValid) {
      throw new AppError(
        "Invalid Credentials",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_CREDENTIALS
      );
    }

    // Hash PIN
    const hashedPin = await hashPassword(data.pin);

    await User.findByIdAndUpdate(data.userId, {
      pin: hashedPin,
      pinActivatedAt: new Date(),
    });

    // Clear user cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(data.userId));
  }

  async setPin(data: SetPinDTO): Promise<void> {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Hash PIN
    const hashedPin = await hashPassword(data.pin);

    await User.findByIdAndUpdate(data.userId, {
      pin: hashedPin,
      pinActivatedAt: new Date(),
    });

    // Clear user cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(data.userId));
    return;
  }

  async verifyPin(data: VerifyPinDTO): Promise<boolean> {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (!user.pin) {
      throw new AppError(
        "PIN not set",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const isPinValid = await comparePassword(data.pin, user.pin);
    return isPinValid;
  }

  async toggle2FA(data: Toggle2FADTO): Promise<void> {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    user.twofactorEnabled = data.enable;
    user.twoFactorEnabledAt = data.enable ? new Date() : undefined;
    await user.save();

    return;
  }

  async verify2FA(data: Verify2FADTO): Promise<AuthResponseDTO | null> {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const isValid = await this.otpService.verify(
      user.id.toString(),
      "2fa",
      data.otp
    );
    if (!isValid) {
      throw new AppError(
        "Invalid or expired OTP",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_TOKEN
      );
    }
    // Clear user cache
    await this.cacheService.delete(CACHE_KEYS.USER_PROFILE(user.id));
    const userDetails = await this.formatUserDetails(user);
    if (!userDetails) {
      throw new AppError(
        "Error formatting user details",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.INTERNAL_ERROR
      );
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user.id.toString(),
      email: user.email,
    });
    const refreshToken = generateRefreshToken({
      id: user.id.toString(),
      email: user.email,
    });

    return { user: userDetails, accessToken, refreshToken };
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
      fcmTokens: user.fcmTokens || null,
      virtualAccount: user.virtualAccount,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      bvn: user.bvn || null,
      nin: user.nin || null,
      loginBiometricEnabled: user.loginBiometricEnabled || false,
      transactionBiometricEnabled: user.transactionBiometricEnabled || false,
      twofactorEnabled: user.twofactorEnabled || false,
      // emailVerifiedAt: user.emailVerifiedAt,
      // phoneVerifiedAt: user.phoneVerifiedAt,
      // pinActivatedAt: user.pinActivatedAt,
      // twoFactorEnabledAt: user.twoFactorEnabledAt,
    };
  }
}
