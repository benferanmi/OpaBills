import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { DepositService } from '@/services/client/DepositService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';

export class DepositController {
  private depositService: DepositService
  constructor() {
    this.depositService = new DepositService();
  }

  createDepositRequest = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const data = { ...req.body, userId };
      const depositRequest = await this.depositService.createDepositRequest(data);
      return sendSuccessResponse(res, depositRequest, 'Deposit request submitted successfully');
    } catch (error) {
      next(error);
    }
  };

  handleDepositWebhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req.body;
      const deposit = await this.depositService.handleDepositWebhook(data);
      return sendSuccessResponse(res, deposit, 'Deposit processed successfully');
    } catch (error) {
      next(error);
    }
  };

  getDeposits = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        status: req.query.status as string,
        provider: req.query.provider as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await this.depositService.getDeposits(userId, filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Deposits retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getDepositRequests = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await this.depositService.getDepositRequests(userId, filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Deposit requests retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getDepositById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { depositId } = req.params;
      const deposit = await this.depositService.getDepositById(depositId);
      return sendSuccessResponse(res, deposit, 'Deposit retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}
