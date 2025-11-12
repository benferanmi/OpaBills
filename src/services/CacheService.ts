import redisConfig, { ensureRedisConnected } from "@/config/redis";
import { CACHE_TTL, CACHE_KEYS } from "@/utils/constants";
import logger from "@/logger";

export class CacheService {
  private async ensureConnection(): Promise<void> {
    await ensureRedisConnected();
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnection();
      const data = await redisConfig.client.get(key);
      if (!data) {
        logger.debug(`Cache MISS: ${key}`);
        return null;
      }
      logger.debug(`Cache HIT: ${key}`);
      return JSON.parse(data);
    } catch (error) {
      logger.error("Cache get error:", error);
      return null;
    }
  }

  async set(
    key: string,
    value: any,
    ttl: number = CACHE_TTL.ONE_HOUR
  ): Promise<void> {
    try {
      await this.ensureConnection();
      const serializedValue = JSON.stringify(value);

      if (ttl) {
        await redisConfig.client.setEx(key, ttl, serializedValue);
      } else {
        await redisConfig.client.set(key, serializedValue);
      }

      logger.debug(`Cache SET: ${key}`, { ttl });
    } catch (error) {
      logger.error("Cache set error:", error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.ensureConnection();
      await redisConfig.client.del(key);
      logger.debug(`Cache DELETE: ${key}`);
    } catch (error) {
      logger.error("Cache delete error:", error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      await this.ensureConnection();
      const keys = await redisConfig.client.keys(pattern);
      if (keys.length > 0) {
        await redisConfig.client.del(keys);
        logger.debug(`Cache DELETE PATTERN: ${pattern}`, {
          deletedCount: keys.length,
        });
      }
    } catch (error) {
      logger.error("Cache delete pattern error:", error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      const result = await redisConfig.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error("Cache exists error:", error);
      return false;
    }
  }

  async increment(key: string, ttl?: number): Promise<number> {
    try {
      await this.ensureConnection();
      const result = await redisConfig.client.incr(key);
      if (ttl) {
        await redisConfig.client.expire(key, ttl);
      }
      return result;
    } catch (error) {
      logger.error("Cache increment error:", error);
      return 0;
    }
  }

  async incrementBy(key: string, by: number = 1): Promise<number> {
    try {
      await this.ensureConnection();
      return await redisConfig.client.incrBy(key, by);
    } catch (error) {
      logger.error("Cache incrementBy error:", error);
      throw error;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.ensureConnection();
      await redisConfig.client.expire(key, ttl);
      logger.debug(`Cache EXPIRE: ${key}`, { ttl });
    } catch (error) {
      logger.error("Cache expire error:", error);
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await redisConfig.client.ttl(key);
    } catch (error) {
      logger.error("Cache TTL error:", error);
      return -1;
    }
  }

  async setNX(key: string, value: any, ttl?: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      const serializedValue = JSON.stringify(value);

      if (ttl) {
        const result = await redisConfig.client.set(key, serializedValue, {
          NX: true,
          EX: ttl,
        });
        return result === "OK";
      } else {
        const result = await redisConfig.client.setNX(key, serializedValue);
        return result === 1;
      }
    } catch (error) {
      logger.error("Cache setNX error:", error);
      return false;
    }
  }

  async acquireLock(
    key: string,
    value: string,
    ttl: number
  ): Promise<string | null> {
    try {
      await this.ensureConnection();
      return await redisConfig.client.set(key, value, { NX: true, EX: ttl });
    } catch (error) {
      logger.error("Cache acquire lock error:", error);
      return null;
    }
  }

  async releaseLock(key: string, value: string): Promise<boolean> {
    try {
      await this.ensureConnection();

      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;

      const result = await redisConfig.client.eval(script, {
        keys: [key],
        arguments: [value],
      });

      return result === 1;
    } catch (error) {
      logger.error("Cache release lock error:", error);
      return false;
    }
  }

  async getMultiple<T>(keys: string[]): Promise<(T | null)[]> {
    try {
      await this.ensureConnection();
      if (keys.length === 0) return [];

      const values = await redisConfig.client.mGet(keys);
      return values.map((val) => (val ? JSON.parse(val) : null));
    } catch (error) {
      logger.error("Cache get multiple error:", error);
      return keys.map(() => null);
    }
  }

  async setMultiple(
    entries: Array<{ key: string; value: any; ttl?: number }>,
    defaultTtl: number = CACHE_TTL.ONE_HOUR
  ): Promise<void> {
    try {
      await this.ensureConnection();

      const pipeline = redisConfig.client.multi();

      for (const { key, value, ttl } of entries) {
        pipeline.setEx(key, ttl ?? defaultTtl, JSON.stringify(value));
      }

      await pipeline.exec();
    } catch (error) {
      logger.error("Cache set multiple error:", error);
    }
  }

  async getTtl(key: string): Promise<number> {
    try {
      await this.ensureConnection();
      return await redisConfig.client.ttl(key);
    } catch (error) {
      logger.error("Cache get TTL error:", error);
      return -2;
    }
  }

  async extendTtl(key: string, additionalSeconds: number): Promise<boolean> {
    try {
      await this.ensureConnection();
      const currentTtl = await redisConfig.client.ttl(key);

      if (currentTtl > 0) {
        await redisConfig.client.expire(key, currentTtl + additionalSeconds);
        return true;
      }

      return false;
    } catch (error) {
      logger.error("Cache extend TTL error:", error);
      return false;
    }
  }

  // ==================== OTP Methods ====================

  async setOTP(
    email: string,
    otp: string,
    type: "registration" | "password_reset" | "2fa"
  ): Promise<void> {
    let key: string;

    switch (type) {
      case "registration":
        key = CACHE_KEYS.OTP_REGISTRATION(email);
        break;
      case "password_reset":
        key = CACHE_KEYS.OTP_PASSWORD_RESET(email);
        break;
      case "2fa":
        key = CACHE_KEYS.OTP(email);
        break;
      default:
        key = CACHE_KEYS.OTP(email);
    }

    await this.set(key, { otp, timestamp: Date.now() }, CACHE_TTL.OTP);
  }

  async getOTP(
    email: string,
    type: "registration" | "password_reset" | "2fa"
  ): Promise<{ otp: string; timestamp: number } | null> {
    let key: string;

    switch (type) {
      case "registration":
        key = CACHE_KEYS.OTP_REGISTRATION(email);
        break;
      case "password_reset":
        key = CACHE_KEYS.OTP_PASSWORD_RESET(email);
        break;
      case "2fa":
        key = CACHE_KEYS.OTP(email);
        break;
      default:
        key = CACHE_KEYS.OTP(email);
    }

    return await this.get<{ otp: string; timestamp: number }>(key);
  }

  async deleteOTP(
    email: string,
    type: "registration" | "password_reset" | "2fa"
  ): Promise<void> {
    let key: string;

    switch (type) {
      case "registration":
        key = CACHE_KEYS.OTP_REGISTRATION(email);
        break;
      case "password_reset":
        key = CACHE_KEYS.OTP_PASSWORD_RESET(email);
        break;
      case "2fa":
        key = CACHE_KEYS.OTP(email);
        break;
      default:
        key = CACHE_KEYS.OTP(email);
    }

    await this.delete(key);
  }

  async incrementOTPAttempts(email: string, type: string): Promise<number> {
    const key = CACHE_KEYS.OTP_ATTEMPTS(email, type);
    const attempts = await this.incrementBy(key);

    if (attempts === 1) {
      await this.expire(key, CACHE_TTL.OTP_ATTEMPTS);
    }

    return attempts;
  }

  async getOTPAttempts(email: string, type: string): Promise<number> {
    const key = CACHE_KEYS.OTP_ATTEMPTS(email, type);
    const attempts = await this.get<number>(key);
    return attempts || 0;
  }

  // ==================== User Profile Methods ====================

  async setUserProfile(userId: string, profile: any): Promise<void> {
    const key = CACHE_KEYS.USER_PROFILE(userId);
    await this.set(key, profile, CACHE_TTL.USER_PROFILE);
  }

  async getUserProfile(userId: string): Promise<any | null> {
    const key = CACHE_KEYS.USER_PROFILE(userId);
    return await this.get(key);
  }

  async deleteUserProfile(userId: string): Promise<void> {
    const key = CACHE_KEYS.USER_PROFILE(userId);
    await this.delete(key);
  }

  // ==================== Token Methods ====================

  async setRefreshToken(tokenId: string, tokenData: any): Promise<void> {
    const key = CACHE_KEYS.REFRESH_TOKEN(tokenId);
    await this.set(key, tokenData, CACHE_TTL.REFRESH_TOKEN);
  }

  async getRefreshToken(tokenId: string): Promise<any | null> {
    const key = CACHE_KEYS.REFRESH_TOKEN(tokenId);
    return await this.get(key);
  }

  async deleteRefreshToken(tokenId: string): Promise<void> {
    const key = CACHE_KEYS.REFRESH_TOKEN(tokenId);
    await this.delete(key);
  }

  async blacklistToken(
    tokenId: string,
    ttl: number = CACHE_TTL.BLACKLISTED_TOKEN
  ): Promise<void> {
    const key = CACHE_KEYS.BLACKLISTED_TOKEN(tokenId);
    await this.set(key, { blacklisted: true, timestamp: Date.now() }, ttl);
  }

  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    const key = CACHE_KEYS.BLACKLISTED_TOKEN(tokenId);
    return await this.exists(key);
  }

  // ==================== Login Attempts Methods ====================

  async incrementLoginAttempts(email: string): Promise<number> {
    const key = CACHE_KEYS.LOGIN_ATTEMPTS(email);
    const attempts = await this.incrementBy(key);

    if (attempts === 1) {
      await this.expire(key, CACHE_TTL.LOGIN_ATTEMPTS);
    }

    return attempts;
  }

  async getLoginAttempts(email: string): Promise<number> {
    const key = CACHE_KEYS.LOGIN_ATTEMPTS(email);
    const attempts = await this.get<number>(key);
    return attempts || 0;
  }

  async resetLoginAttempts(email: string): Promise<void> {
    const key = CACHE_KEYS.LOGIN_ATTEMPTS(email);
    await this.delete(key);
  }

  // ==================== Utility Methods ====================

  async clearAll(): Promise<void> {
    try {
      await this.ensureConnection();
      await redisConfig.client.flushAll();
      logger.info("Cache cleared successfully");
    } catch (error) {
      logger.error("Cache clear error:", error);
      throw error;
    }
  }

  async getStats(): Promise<any> {
    try {
      await this.ensureConnection();
      const info = await redisConfig.client.info();
      return info;
    } catch (error) {
      logger.error("Cache stats error:", error);
      return null;
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;
