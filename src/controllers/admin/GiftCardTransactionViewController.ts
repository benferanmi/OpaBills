import { Request, Response, NextFunction } from 'express';
import { GiftCardTransactionViewService } from '@/services/admin/GiftCardTransactionViewService';

export class GiftCardTransactionViewController {
  private giftCardTransactionViewService: GiftCardTransactionViewService;

  constructor() {
    this.giftCardTransactionViewService = new GiftCardTransactionViewService();
  }

  listGiftCardTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, userId, status, cardType, startDate, endDate } = req.query;
      const result = await this.giftCardTransactionViewService.listGiftCardTransactions(
        Number(page),
        Number(limit),
        { userId, status, cardType, startDate, endDate }
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getGiftCardTransactionDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const transaction = await this.giftCardTransactionViewService.getGiftCardTransactionDetails(id);
      res.json(transaction);
    } catch (error) {
      next(error);
    }
  };

  getGiftCardTransactionStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await this.giftCardTransactionViewService.getGiftCardTransactionStats({ startDate, endDate });
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
