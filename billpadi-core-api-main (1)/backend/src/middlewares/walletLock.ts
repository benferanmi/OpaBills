import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { sendErrorResponse } from '@/utils/helpers';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

// Simple in-memory wallet lock (use Redis in production)
const walletLocks = new Map<string, number>();

export const walletLock = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const lockKey = `wallet_${userId}`;
    const now = Date.now();
    
    const existingLock = walletLocks.get(lockKey);
    
    // Check if wallet is already locked (within last 30 seconds)
    if (existingLock && now - existingLock < 30000) {
      return sendErrorResponse(
        res,
        'A transaction is currently in progress. Please wait.',
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.WALLET_LOCKED
      );
    }
    
    // Set lock
    walletLocks.set(lockKey, now);
    
    // Cleanup lock after response
    res.on('finish', () => {
      walletLocks.delete(lockKey);
    });
    
    next();
  } catch (error) {
    next(error);
  }
};
