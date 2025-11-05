import jwt, { SignOptions } from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { AdminJWTPayload } from "@/types/admin";
import logger from "@/logger";
import { CacheService } from "@/services/CacheService";
export interface AdminRefreshTokenPayload {
  adminId: string;
  tokenId: string;
  deviceInfo?: string | undefined;
  generation: number;
  family: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface AdminTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface AdminJWTConfig {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
}

class AdminJWTUtil {
  private config: AdminJWTConfig;
  private cacheService: CacheService;

  constructor() {
    this.config = {
      accessSecret:
        process.env.JWT_ADMIN_ACCESS_SECRET ||
        "admin-access-secret-pokkjsu-8ujSd3",
      refreshSecret:
        process.env.JWT_ADMIN_REFRESH_SECRET ||
        "admin-refresh-secret-pokkjsu-8ujSd3",
      accessExpiresIn: process.env.JWT_ADMIN_ACCESS_EXPIRES_IN || "15m",
      refreshExpiresIn: process.env.JWT_ADMIN_REFRESH_EXPIRES_IN || "7d",
    };
    this.cacheService = new CacheService();
  }

  generateAccessToken(payload: {
    adminId: string;
    email: string;
    adminLevel: string;
    tokenId: string;
    generation?: number;
  }): string {
    const jwtPayload: AdminJWTPayload = {
      id: payload.adminId,
      adminId: payload.adminId,
      email: payload.email,
      adminLevel: payload.adminLevel,
      tokenId: payload.tokenId,
      generation: payload.generation || 0,
    };

    return jwt.sign(jwtPayload, this.config.accessSecret, {
      expiresIn: this.config.accessExpiresIn,
      issuer: "pelbliss-admin",
      audience: "pelbliss-admin-client",
    } as jwt.SignOptions);
  }

  generateRefreshToken(payload: {
    adminId: string;
    deviceInfo?: string;
    generation?: number;
    family?: string;
  }): {
    token: string;
    tokenId: string;
    family: string;
    generation: number;
  } {
    const tokenId = uuidv4();
    const family = payload.family || uuidv4();
    const generation = (payload.generation || 0) + 1;

    const refreshPayload: AdminRefreshTokenPayload = {
      adminId: payload.adminId,
      tokenId,
      deviceInfo: payload.deviceInfo,
      generation,
      family,
    };

    const token = jwt.sign(refreshPayload, this.config.refreshSecret, {
      expiresIn: this.config.refreshExpiresIn,
      issuer: "pelbliss-admin",
      audience: "pelbliss-admin-refresh",
    } as jwt.SignOptions);

    return { token, tokenId, family, generation };
  }

  generateTokenPair(payload: {
    adminId: string;
    email: string;
    adminLevel: string;
    deviceInfo?: string;
    generation?: number;
    family?: string;
  }): AdminTokenPair & { tokenId: string; family: string; generation: number } {
    const refreshTokenData = this.generateRefreshToken({
      adminId: payload.adminId,
      deviceInfo: payload.deviceInfo,
      generation: payload.generation,
      family: payload.family,
    });

    const accessToken = this.generateAccessToken({
      adminId: payload.adminId,
      email: payload.email,
      adminLevel: payload.adminLevel,
      tokenId: refreshTokenData.tokenId,
      generation: refreshTokenData.generation,
    });

    const expiresIn = this.getTokenExpirationTime(this.config.accessExpiresIn);

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      tokenId: refreshTokenData.tokenId,
      family: refreshTokenData.family,
      generation: refreshTokenData.generation,
      expiresIn,
    };
  }

  verifyAccessToken(token: string): AdminJWTPayload {
    try {
      const decoded = jwt.verify(
        token,
        this.config.accessSecret
      ) as AdminJWTPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("ADMIN_ACCESS_TOKEN_EXPIRED");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("ADMIN_ACCESS_TOKEN_INVALID");
      }
      throw new Error("ADMIN_ACCESS_TOKEN_VERIFICATION_FAILED");
    }
  }

  verifyRefreshToken(token: string): AdminRefreshTokenPayload {
    try {
      const decoded = jwt.verify(
        token,
        this.config.refreshSecret
      ) as AdminRefreshTokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error("ADMIN_REFRESH_TOKEN_EXPIRED");
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error("ADMIN_REFRESH_TOKEN_INVALID");
      }
      throw new Error("ADMIN_REFRESH_TOKEN_VERIFICATION_FAILED");
    }
  }

  async markTokenAsUsed(tokenId: string): Promise<void> {
    const key = `admin:refresh_used:${tokenId}`;
    await this.cacheService.set(
      key,
      { used: true, timestamp: Date.now() },
      this.getTokenExpirationTime(this.config.refreshExpiresIn)
    );
    logger.info(`Admin refresh token marked as used: ${tokenId}`);
  }

  async isTokenUsed(tokenId: string): Promise<boolean> {
    const key = `admin:refresh_used:${tokenId}`;
    return await this.cacheService.exists(key);
  }

  async invalidateTokenFamily(family: string, adminId: string): Promise<void> {
    const pattern = `admin:refresh_token:${adminId}:${family}:*`;
    await this.cacheService.deletePattern(pattern);

    const blacklistKey = `admin:blacklist_family:${family}`;
    await this.cacheService.set(
      blacklistKey,
      {
        blacklisted: true,
        timestamp: Date.now(),
        adminId,
      },
      this.getTokenExpirationTime(this.config.refreshExpiresIn)
    );

    logger.warn(
      `Admin token family invalidated: ${family} for admin: ${adminId}`
    );
  }

  async isTokenFamilyBlacklisted(family: string): Promise<boolean> {
    const key = `admin:blacklist_family:${family}`;
    return await this.cacheService.exists(key);
  }

  async storeRefreshTokenMetadata(
    tokenId: string,
    adminId: string,
    family: string,
    generation: number,
    metadata: any = {}
  ): Promise<void> {
    const key = `admin:refresh_token:${adminId}:${family}:${generation}`;
    await this.cacheService.set(
      key,
      {
        tokenId,
        adminId,
        family,
        generation,
        createdAt: Date.now(),
        ...metadata,
      },
      this.getTokenExpirationTime(this.config.refreshExpiresIn)
    );
  }

  async getRefreshTokenMetadata(
    adminId: string,
    family: string,
    generation: number
  ): Promise<any> {
    const key = `admin:refresh_token:${adminId}:${family}:${generation}`;
    return await this.cacheService.get(key);
  }

  async detectTokenReuse(decoded: AdminRefreshTokenPayload): Promise<boolean> {
    if (await this.isTokenUsed(decoded.tokenId)) {
      logger.warn(`Admin refresh token reuse detected`, {
        adminId: decoded.adminId,
        tokenId: decoded.tokenId,
        family: decoded.family,
        generation: decoded.generation,
      });
      return true;
    }

    if (await this.isTokenFamilyBlacklisted(decoded.family)) {
      logger.warn(`Admin blacklisted token family used`, {
        adminId: decoded.adminId,
        family: decoded.family,
      });
      return true;
    }

    return false;
  }

  async handleSuspiciousActivity(
    decoded: AdminRefreshTokenPayload
  ): Promise<void> {
    await this.invalidateTokenFamily(decoded.family, decoded.adminId);

    // Log security incident
    logger.error(`Security incident: Admin refresh token abuse detected`, {
      adminId: decoded.adminId,
      tokenId: decoded.tokenId,
      family: decoded.family,
      generation: decoded.generation,
      timestamp: Date.now(),
    });

    // TODO: Implement additional security measures
    // - Email notification to admin
    // - Temporary account lock
    // - Force password reset
  }

  decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer") return null;

    return parts[1];
  }

  private getTokenExpirationTime(expiresIn: string): number {
    const match = expiresIn.match(/^(\d+)([smhd])$/);
    if (!match) return 900;

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value;
      case "m":
        return value * 60;
      case "h":
        return value * 60 * 60;
      case "d":
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }

  isTokenExpired(token: string): boolean {
    try {
      const decoded: any = jwt.decode(token);
      if (!decoded || !decoded.exp) return true;

      const currentTime = Math.floor(Date.now() / 1000);
      return decoded.exp < currentTime;
    } catch (error) {
      return true;
    }
  }

  getTimeUntilExpiration(token: string): number {
    try {
      const decoded: any = jwt.decode(token);
      if (!decoded || !decoded.exp) return 0;

      const currentTime = Math.floor(Date.now() / 1000);
      return Math.max(0, decoded.exp - currentTime);
    } catch (error) {
      return 0;
    }
  }

  isSuperAdmin(payload: AdminJWTPayload): boolean {
    return payload.adminLevel === "super_admin";
  }
}

export const adminJwtUtil = new AdminJWTUtil();
export default adminJwtUtil;
