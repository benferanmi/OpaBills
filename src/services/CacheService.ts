import { getRedisClient } from "@/config/redis";
import { CACHE_TTL } from "@/utils/constants";
import { RedisClientType } from "redis";

export class CacheService {
  private redis: RedisClientType | null = null;

  private getRedis(): RedisClientType {
    if (!this.redis) {
      this.redis = getRedisClient();
    }
    return this.redis;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await this.getRedis().get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async set(
    key: string,
    value: any,
    ttl: number = CACHE_TTL.ONE_HOUR
  ): Promise<void> {
    try {
      await this.getRedis().setEx(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error("Cache set error:", error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.getRedis().del(key);
    } catch (error) {
      console.error("Cache delete error:", error);
    }
  }

  async deletePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.getRedis().keys(pattern);
      if (keys.length > 0) {
        await this.getRedis().del(keys);
      }
    } catch (error) {
      console.error("Cache delete pattern error:", error);
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.getRedis().exists(key);
      return result === 1;
    } catch (error) {
      console.error("Cache exists error:", error);
      return false;
    }
  }

  async increment(key: string, ttl?: number): Promise<number> {
    try {
      const result = await this.getRedis().incr(key);
      if (ttl) {
        await this.getRedis().expire(key, ttl);
      }
      return result;
    } catch (error) {
      console.error("Cache increment error:", error);
      return 0;
    }
  }

  async acquireLock(key: string, value: string, ttl: number) {
    const redis = this.getRedis();
    return redis.set(key, value, { NX: true, EX: ttl });
  }
}
