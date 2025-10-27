import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { WithdrawalService } from '@/services/client/WithdrawalService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';

export class WithdrawalController {
  private withdrawalService: WithdrawalService
  constructor() {
    this.withdrawalService = new WithdrawalService();
  }

  createWithdrawalRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const data = { ...req.body, userId };
      const withdrawalRequest = await this.withdrawalService.createWithdrawalRequest(data);
      return sendSuccessResponse(res, withdrawalRequest, 'Withdrawal request submitted successfully');
    } catch (error) {
      next(error);
    }
  };

  getWithdrawalRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await this.withdrawalService.getWithdrawalRequests(userId, filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Withdrawal requests retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getWithdrawalRequestById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { requestId } = req.params;
      const request = await this.withdrawalService.getWithdrawalRequestById(requestId);
      return sendSuccessResponse(res, request, 'Withdrawal request retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}
