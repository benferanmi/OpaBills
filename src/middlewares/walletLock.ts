import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { CacheService } from "@/services/CacheService";
const LOCK_TTL = 30; // Lock time-to-live in seconds
const LOCK_PREFIX = "wallet_lock:";

const cacheService = new CacheService();

export const walletLock = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const lockKey = `${LOCK_PREFIX}${userId}`;

    // Try to acquire lock using SET NX (set if not exists) with expiration
    const lockAcquired = await cacheService.acquireLock(
      lockKey,
      Date.now().toString(),
      LOCK_TTL
    );

    // If lock not acquired (returns null), wallet is already locked
    if (!lockAcquired) {
      logger.warn(`Wallet lock conflict for user ${userId}`);
      return sendErrorResponse(
        res,
        "A transaction is currently in progress. Please wait.",
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.WALLET_LOCKED
      );
    }

    logger.debug(`Wallet lock acquired for user ${userId}`);

    // Release lock after response is sent
    res.on("finish", async () => {
      try {
        await cacheService.delete(lockKey);
        logger.debug(`Wallet lock released for user ${userId}`);
      } catch (error) {
        logger.error(`Error releasing wallet lock for user ${userId}:`, error);
      }
    });

    next();
  } catch (error) {
    logger.error("Error in walletLock middleware:", error);
    next(error);
  }
};
