import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { WalletService } from '@/services/WalletService';
import { sendSuccessResponse } from '@/utils/helpers';

export class WalletController {
  constructor(private walletService: WalletService) {}

  getWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { type } = req.query;
      const wallet = await this.walletService.getWallet(userId, type as any);
      return sendSuccessResponse(res, wallet, 'Wallet retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getAllWallets = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const wallets = await this.walletService.getAllWallets(userId);
      return sendSuccessResponse(res, wallets, 'Wallets retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  creditWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, reason, walletType } = req.body;
      const result = await this.walletService.creditWallet(userId, amount, reason, walletType);
      return sendSuccessResponse(res, result, 'Wallet credited successfully');
    } catch (error) {
      next(error);
    }
  };

  debitWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, reason, walletType } = req.body;
      const result = await this.walletService.debitWallet(userId, amount, reason, walletType);
      return sendSuccessResponse(res, result, 'Wallet debited successfully');
    } catch (error) {
      next(error);
    }
  };
}
