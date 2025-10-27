import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { ReferralService } from '@/services/client/ReferralService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';

export class ReferralController {
  constructor(private referralService: ReferralService) {}

  getReferralStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const stats = await this.referralService.getReferralStats(userId);
      return sendSuccessResponse(res, stats, 'Referral stats and earnings retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getReferredUsers = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.referralService.getReferredUsers(userId, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Referred users retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getReferralEarnings = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.referralService.getReferralEarnings(userId, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Referral earnings retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getReferralTerms = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const terms = await this.referralService.getReferralTerms();
      return sendSuccessResponse(res, terms, 'Referral terms retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}
