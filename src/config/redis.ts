import { createClient, RedisClientType } from "redis";
import logger from "../logger";

let redisClient: RedisClientType;
let connectionString: string;

const setupEventHandlers = (client: RedisClientType): void => {
  client.on("error", (err) => {
    logger.error("Redis Client Error:", err);
  });

  client.on("connect", () => {
    logger.info("Redis Client Connected");
  });

  client.on("ready", () => {
    logger.info("Redis Client Ready");
  });

  client.on("end", () => {
    logger.warn("Redis Client Disconnected");
  });

  client.on("reconnecting", () => {
    logger.info("Redis Client Reconnecting...");
  });
};

export const connectRedis = async (): Promise<RedisClientType> => {
  // Called when the Redis client is disconnected
  try {
    connectionString = process.env.REDIS_URL || "redis://localhost:6379";
    logger.debug(
      `Connecting to Redis using connection string: ${connectionString}`
      // Called when the Redis client is reconnecting
    );

    redisClient = createClient({
      url: connectionString,
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error("Redis reconnection attempts exhausted");
            return new Error("Redis reconnection failed");
          }
          const delay = Math.min(retries * 50, 1000);
          logger.warn(`Redis reconnecting in ${delay}ms (attempt ${retries})`);
          return delay;
        },
      },
    });

    setupEventHandlers(redisClient);

    logger.debug("Attempting to connect to Redis...");
    await redisClient.connect();
    logger.info("Redis connection established successfully");

    return redisClient;
  } catch (error) {
    logger.error("Error connecting to Redis:", error);
    throw error;
  }
};

export const getRedisClient = (): RedisClientType => {
  if (!redisClient) {
    const error = new Error("redis error");
    console.log(error.stack)
    logger.error("Attempted to get Redis client before initialization", );
    throw new Error("Redis client not initialized");
  }
  logger.debug("Redis client retrieved successfully");
  return redisClient;
};

export const closeRedis = async (): Promise<void> => {
  if (redisClient) {
    try {
      logger.debug("Closing Redis connection...");
      await redisClient.quit();
      logger.info("Redis connection closed successfully");
    } catch (error) {
      logger.error("Error closing Redis connection:", error);
      throw error;
    }
  } else {
    logger.debug("No Redis client to close");
  }
};

export default { connectRedis, getRedisClient, closeRedis };
