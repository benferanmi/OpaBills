import { Request, Response, NextFunction } from 'express';
import { sendErrorResponse } from '@/utils/helpers';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

// Simple service status check (can be extended to check database/cache)
const serviceStatus = new Map<string, boolean>([
  ['airtime', true],
  ['data', true],
  ['electricity', true],
  ['tv', true],
  ['betting', true],
  ['education', true],
  ['internationalirtime', true],
  ['internationaldata', true],
  ['giftcard', true],
  ['crypto', true],
  ['flight', true],
]);

export const serviceCheck = (serviceName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const isActive = serviceStatus.get(serviceName);
    
    if (!isActive) {
      return sendErrorResponse(
        res,
        `${serviceName} service is currently unavailable`,
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
    
    next();
  };
};
