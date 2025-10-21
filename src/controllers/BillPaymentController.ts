import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { BillPaymentService } from '@/services/BillPaymentService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';
import { HTTP_STATUS } from '@/utils/constants';

export class BillPaymentController {
  constructor(private billPaymentService: BillPaymentService) {}

  purchaseAirtime = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseAirtime({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'Airtime purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  purchaseData = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseData({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'Data purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  purchaseCableTv = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseCableTv({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'Cable TV subscription initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  purchaseElectricity = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseElectricity({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'Electricity payment initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  getBillPaymentTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        type: req.query.type,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const result = await this.billPaymentService.getBillPaymentTransactions(userId, filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Bill payment transactions retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };
}
