import { Admin } from "@/models/admin/Index";
import { OTPService } from "../OTPService";
import { HTTP_STATUS } from "@/utils/constants";
import adminJwtUtil from "@/config/admin/jwt";
import bcryptUtil from "@/utils/bcryptjs";
import logger from "@/logger";
import RefreshToken from "@/models/admin/RefreshToken";

export interface LoginRequest {
  email: string;
  password: string;
}
export interface LoginRequestDTO {
  admin: LoginRequest;
  ip?: string;
  userAgent?: string;
}

export class AuthService {
  private otpService = new OTPService();

  async login(data: LoginRequest, ip?: string, userAgent?: string) {
    const { email, password } = data;

    const admin = await Admin.findOne({ email }).select(
      "+password +activeTokenId"
    );

    if (!admin) {
      throw {
        message: "Invalid credentials",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      };
    }

    if (admin.isLocked()) {
      throw { message: "Account is locked", statusCode: HTTP_STATUS.LOCKED };
    }

    const isPasswordValid = await admin.comparePassword(password);
    if (!isPasswordValid) {
      await admin.incrementLoginAttempts();
      throw {
        message: "Invalid credentials",
        statusCode: HTTP_STATUS.UNAUTHORIZED,
      };
    }

    await admin.resetLoginAttempts();
    admin.lastLogin = new Date();

    if (admin.activeTokenId) {
      logger.info("Invalidating previous session for new login", {
        adminId: admin._id,
        previousTokenId: admin.activeTokenId,
      });

      try {
        const previousTokenDoc = await RefreshToken.findActiveToken(
          admin.activeTokenId
        );
        if (previousTokenDoc) {
          const previousDecoded = adminJwtUtil.decodeToken(
            previousTokenDoc.token
          );
          if (previousDecoded?.family) {
            await adminJwtUtil.invalidateTokenFamily(
              previousDecoded.family,
              admin._id.toString()
            );
          }
        }
      } catch (error) {
        logger.warn("Could not invalidate previous token family", { error });
      }

      await RefreshToken.deactivateAllUserTokens(admin._id.toString(), "admin");
    }

    //  Two-Factor Authentication
    if (admin.twoFactorEnabled) {
      admin.activeTokenId = null;
      await admin.save();

      //TODO   this.otpService.generateAndSendOTP(email, "2fa");
      return {
        success: true,
        statusCode: HTTP_STATUS.LOCKED,
        message:
          "Just one more step! We've sent a verification code to your email. Please check your inbox and enter the code to complete your login.",
      };
    }

    // Generate new token pair (creates new family)
    const tokens = adminJwtUtil.generateTokenPair({
      adminId: admin._id.toString(),
      email: admin.email,
      adminLevel: admin.adminLevel,
      deviceInfo: userAgent,
    });

    // Store refresh token metadata for reuse detection
    await adminJwtUtil.storeRefreshTokenMetadata(
      tokens.tokenId,
      admin._id.toString(),
      tokens.family,
      tokens.generation,
      {
        ip,
        userAgent,
        loginType: "password",
      }
    );

    // Update admin with new active session
    admin.activeTokenId = tokens.tokenId;
    admin.lastActiveAt = new Date();
    admin.totalLogins = (admin.totalLogins || 0) + 1;
    await admin.save();

    // TODO
    // await this.saveRefreshToken(
    //   tokens.tokenId,
    //   admin._id.toString(),
    //   "admin",
    //   tokens.refreshToken,
    //   ip,
    //   userAgent,
    //   tokens.family,
    //   tokens.generation
    // );

    logger.info("New login session created", {
      adminId: admin._id.toString(),
      tokenId: tokens.tokenId,
      family: tokens.family,
      generation: tokens.generation,
    });

    return {
      admin: {
        id: admin._id.toString(),
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        phone: admin.phone,
        adminLevel: admin.adminLevel,
        twoFactorEnabled: admin.twoFactorEnabled,
        profilePicture: admin.profilePicture,
        permissions: admin.permissions,
      },
      tokens: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      },
    };
  }


  async logout(authHeader?: string): Promise<void> {
    if (!authHeader) return;

    const token = adminJwtUtil.extractTokenFromHeader(authHeader);
    if (!token) return;

    try {
      const decoded = adminJwtUtil.decodeToken(token);

      if (decoded?.adminId) {
        await Admin.findByIdAndUpdate(decoded.adminId, {
          activeTokenId: null,
          lastActiveAt: new Date(),
        });

        // Find and invalidate the token family
        if (decoded.tokenId) {
          try {
            const tokenDoc = await RefreshToken.findActiveToken(
              decoded.tokenId
            );
            if (tokenDoc) {
              const refreshDecoded = adminJwtUtil.decodeToken(tokenDoc.token);
              if (refreshDecoded?.family) {
                await adminJwtUtil.invalidateTokenFamily(
                  refreshDecoded.family,
                  decoded.adminId
                );
              }
            }
          } catch (error) {
            logger.warn("Could not invalidate token family during logout", {
              error,
            });
          }

          await RefreshToken.deactivateAllUserTokens(decoded.adminId, "admin");
        }

        logger.info("Admin logged out successfully", {
          adminId: decoded.adminId,
          tokenId: decoded.tokenId,
        });
      }

      //     await CacheService.blacklistToken(token);
    } catch (error) {
      logger.error("Logout error:", error);
      //    await CacheService.blacklistToken(token);
      throw new Error("Logout failed");
    }
  }


  async refreshToken(
    refreshToken: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    try {
      const decoded = adminJwtUtil.verifyRefreshToken(refreshToken);

      const isSuspicious = await adminJwtUtil.detectTokenReuse(decoded);
      if (isSuspicious) {
        await adminJwtUtil.handleSuspiciousActivity(decoded);
        throw {
          message: "Security violation detected. All sessions invalidated.",
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        };
      }

      const tokenDoc = await RefreshToken.findActiveToken(decoded.tokenId);
      if (!tokenDoc) {
        logger.warn("Refresh token not found in database", {
          adminId: decoded.adminId,
          tokenId: decoded.tokenId,
          family: decoded.family,
        });

        // This could indicate token theft - invalidate the family
        await adminJwtUtil.invalidateTokenFamily(
          decoded.family,
          decoded.adminId
        );

        throw {
          message: "Invalid refresh token",
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        };
      }

      // Verify admin
      const admin = await Admin.findById(decoded.adminId);
      if (!admin || admin.status !== "active") {
        throw {
          message: "Admin not found or inactive",
          statusCode: HTTP_STATUS.UNAUTHORIZED,
        };
      }

      await adminJwtUtil.markTokenAsUsed(decoded.tokenId);

      await tokenDoc.deactivate();

      // Generating new token pair with rotation (same family, incremented generation)
      const tokens = adminJwtUtil.generateTokenPair({
        adminId: admin._id.toString(),
        email: admin.email,
        adminLevel: admin.adminLevel,
        family: decoded.family,
        generation: decoded.generation,
        deviceInfo: userAgent,
      });

      await adminJwtUtil.storeRefreshTokenMetadata(
        tokens.tokenId,
        admin._id.toString(),
        tokens.family,
        tokens.generation,
        {
          ip,
          userAgent,
          previousTokenId: decoded.tokenId,
        }
      );

      // await this.saveRefreshToken(
      //   tokens.tokenId,
      //   admin._id.toString(),
      //   "admin",
      //   tokens.refreshToken,
      //   ip,
      //   userAgent,
      //   tokens.family,
      //   tokens.generation
      // );

      admin.activeTokenId = tokens.tokenId;
      admin.lastActiveAt = new Date();
      await admin.save();

      logger.info("Refresh token rotated successfully", {
        adminId: admin._id.toString(),
        oldTokenId: decoded.tokenId,
        newTokenId: tokens.tokenId,
        family: tokens.family,
        oldGeneration: decoded.generation,
        newGeneration: tokens.generation,
      });

      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
      };
    } catch (error: any) {
      if (
        error.message?.includes("TOKEN_EXPIRED") ||
        error.message?.includes("TOKEN_INVALID")
      ) {
        try {
          const decoded = adminJwtUtil.decodeToken(refreshToken);
          if (decoded?.family && decoded?.adminId) {
            logger.warn(
              "Invalid/expired token used - potential security issue",
              {
                adminId: decoded.adminId,
                family: decoded.family,
              }
            );

            await adminJwtUtil.invalidateTokenFamily(
              decoded.family,
              decoded.adminId
            );
          }
        } catch (decodeError) {
          logger.warn("Malformed refresh token attempted");
        }
      }

      throw error;
    }
  }


  async forgotPassword(email: string): Promise<void> {
    const admin = await Admin.findOne({ email });
    if (!admin) {
      throw new Error("Admin Account not found");
      return;
    }
    const name = `${admin.firstName} ${admin.lastName}`
    await this.otpService.generateAndStore(email, "password_reset", name);
  }


  async verifyOtpAndResetPassword(data: {
    email: string;
    otp: string;
    newPassword: string;
  }): Promise<void> {
    const { email, otp, newPassword } = data;

    const admin = await Admin.findOne({ email }).select(
      "+password +passwordHistory"
    );
    if (!admin) {
      throw { message: "Admin not found", statusCode: HTTP_STATUS.NOT_FOUND };
    }

    // Verify OTP
    await this.otpService.verify(email, "password_reset", otp);

    // Check password history
    if (
      await bcryptUtil.isPasswordInHistory(newPassword, admin.passwordHistory)
    ) {
      throw {
        message: "Cannot reuse recent passwords",
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    // Update password
    const hashedPassword = await bcryptUtil.hashPassword(newPassword);
    admin.password = newPassword;
    admin.passwordHistory = bcryptUtil.updatePasswordHistory(
      admin.passwordHistory,
      hashedPassword
    );
    await admin.save();

    // Invalidate all refresh tokens
    await RefreshToken.deactivateAllUserTokens(admin._id.toString(), "admin");
  }

  async changePassword(
    adminId: string,
    newPassword: string,
    currentPassword: string
  ) {
    const admin = await Admin.findById(adminId).select(
      "+password +passwordHistory"
    );
    if (!admin) {
      throw { message: "Admin not found", statusCode: HTTP_STATUS.NOT_FOUND };
    }

    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      throw {
        message: "Current password is incorrect",
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    if (
      await bcryptUtil.isPasswordInHistory(newPassword, admin.passwordHistory)
    ) {
      throw {
        message: "Cannot reuse recent passwords",
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    //Update password
    admin.password = newPassword;

    const hashedPassword = await bcryptUtil.hashPassword(newPassword);
    admin.passwordHistory = bcryptUtil.updatePasswordHistory(
      admin.passwordHistory,
      hashedPassword
    );
    admin.updatedAt = new Date();
    await admin.save();

    logger.info("Admin password changed", { adminId });
  }

  //   private async saveRefreshToken();
}
