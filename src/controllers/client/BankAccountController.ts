import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { BankAccountService } from '@/services/client/BankAccountService';
import { sendSuccessResponse } from '@/utils/helpers';
import { HTTP_STATUS } from '@/utils/constants';

export class BankAccountController {
  constructor(private bankAccountService: BankAccountService) {}

  createBankAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const account = await this.bankAccountService.createBankAccount({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, account, 'Bank account created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  getUserBankAccounts = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const accounts = await this.bankAccountService.getUserBankAccounts(userId);
      return sendSuccessResponse(res, accounts, 'Bank accounts retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getBankAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const account = await this.bankAccountService.getBankAccount(id);
      return sendSuccessResponse(res, account, 'Bank account retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  deleteBankAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.bankAccountService.deleteBankAccount(id);
      return sendSuccessResponse(res, null, 'Bank account deleted successfully');
    } catch (error) {
      next(error);
    }
  };

  verifyBankAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { bankCode, accountNumber } = req.body;
      const result = await this.bankAccountService.verifyBankAccount(bankCode, accountNumber);
      return sendSuccessResponse(res, result, 'Bank account verified successfully');
    } catch (error) {
      next(error);
    }
  };

  setDefaultBankAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const account = await this.bankAccountService.setDefaultBankAccount(userId, id);
      return sendSuccessResponse(res, account, 'Default bank account set successfully');
    } catch (error) {
      next(error);
    }
  };
}
