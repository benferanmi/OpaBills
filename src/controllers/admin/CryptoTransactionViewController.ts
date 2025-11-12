import { Request, Response, NextFunction } from 'express';
import { CryptoTransactionViewService } from '@/services/admin/CryptoTransactionViewService';

export class CryptoTransactionViewController {
  private cryptoTransactionViewService: CryptoTransactionViewService;

  constructor() {
    this.cryptoTransactionViewService = new CryptoTransactionViewService();
  }

  listCryptoTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, userId, status, type, cryptocurrency, startDate, endDate } = req.query;
      const result = await this.cryptoTransactionViewService.listCryptoTransactions(
        Number(page),
        Number(limit),
        { userId, status, type, cryptocurrency, startDate, endDate }
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getCryptoTransactionDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const transaction = await this.cryptoTransactionViewService.getCryptoTransactionDetails(id);
      res.json(transaction);
    } catch (error) {
      next(error);
    }
  };

  getCryptoTransactionStats = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const stats = await this.cryptoTransactionViewService.getCryptoTransactionStats({ startDate, endDate });
      res.json(stats);
    } catch (error) {
      next(error);
    }
  };
}
