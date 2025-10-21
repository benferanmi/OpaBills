import { Admin } from "@/models/admin/Index";
import { OTPService } from "../OTPService";
import { HTTP_STATUS } from "@/utils/constants";
import adminJwtUtil from "@/config/admin/jwt";
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

//   private async saveRefreshToken();
}
