import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { WalletService } from "@/services/client/WalletService";
import { PaymentService } from "@/services/client/PaymentService";
import { WithdrawalService } from "@/services/client/WithdrawalService";
import { sendSuccessResponse } from "@/utils/helpers";
import { DepositService } from "@/services/client/DepositService";

export class WalletController {
  private walletService: WalletService;
  private paymentService: PaymentService;
  private withdrawalService: WithdrawalService;
  private depositService: DepositService;
  constructor() {
    this.walletService = new WalletService();
    this.paymentService = new PaymentService();
    this.withdrawalService = new WithdrawalService();
    this.depositService = new DepositService();
  }

  getWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { type } = req.query;
      const wallet = await this.walletService.getWallet(userId, type as any);
      return sendSuccessResponse(res, wallet, "Wallet retrieved successfully");
    } catch (error) {
      next(error);
    }
  };

  getAllWallets = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const wallets = await this.walletService.getAllWallets(userId);
      return sendSuccessResponse(
        res,
        wallets,
        "Wallets retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  creditWallet = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { amount, reason, walletType } = req.body;
      const result = await this.walletService.creditWallet(
        userId,
        amount,
        reason,
        walletType
      );
      return sendSuccessResponse(res, result, "Wallet credited successfully");
    } catch (error) {
      next(error);
    }
  };

  debitWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, reason, walletType } = req.body;
      const result = await this.walletService.debitWallet(
        userId,
        amount,
        reason,
        walletType
      );
      return sendSuccessResponse(res, result, "Wallet debited successfully");
    } catch (error) {
      next(error);
    }
  };

  getWalletTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const {
        type,
        status,
        startDate,
        endDate,
        page = 1,
        limit = 20,
      } = req.query;
      const result = await this.walletService.getWalletTransactions(
        userId,
        { type, status, startDate, endDate },
        Number(page),
        Number(limit)
      );
      return sendSuccessResponse(
        res,
        result,
        "Wallet transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  }
  getBalanceHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { type = "main", days = 30 } = req.query;
      const result = await this.walletService.getBalanceHistory(
        userId,
        type as any,
        Number(days)
      );
      return sendSuccessResponse(
        res,
        result,
        "Balance history retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const result = await this.paymentService.getProviders();
      return sendSuccessResponse(
        res,
        result,
        "Providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  fundWallet = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { amount, method, provider } = req.body;
      const result = await this.paymentService.initializePayment({
        userId,
        amount,
        method,
        provider,
      });
      return sendSuccessResponse(
        res,
        result,
        "Payment initialized successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  verifyTransaction = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.body;
      const result = await this.paymentService.verifyPayment(reference);
      return sendSuccessResponse(res, result, "Payment verified successfully");
    } catch (error) {
      next(error);
    }
  };
  recordDeposit = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { amount, provider, proof } = req.body;

      const depositRequest = await this.depositService.createDepositRequest({
        userId,
        amount,
        provider,
        proof,
      });

      return sendSuccessResponse(
        res,
        depositRequest,
        "Deposit request created successfully"
      );
    } catch (error) {
      next(error);
    }
  };
  transferFunds = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { beneficiary: recipient, amount, remark } = req.body;
      const result = await this.walletService.transferFunds(
        userId,
        recipient,
        amount,
        remark
      );
      return sendSuccessResponse(res, result, "Transfer successful");
    } catch (error) {
      next(error);
    }
  };

  verifyBeneficiary = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { identifier } = req.body;
      const result = await this.walletService.verifyBeneficiary(identifier);
      return sendSuccessResponse(
        res,
        result,
        "Beneficiary verified successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getBeneficiaries = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const result = await this.walletService.getBeneficiaries(userId);
      return sendSuccessResponse(
        res,
        result,
        "Beneficiaries retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  searchBeneficiaries = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { query } = req.body;
      const result = await this.walletService.searchBeneficiaries(query);
      return sendSuccessResponse(
        res,
        result,
        "Search results retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  withdrawFunds = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { amount, bankAccountId, provider } = req.body;
      const result = await this.withdrawalService.withdrawFunds({
        userId,
        amount,
        bankAccountId,
        provider,
      });
      return sendSuccessResponse(
        res,
        result,
        "Withdrawal request created successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  bankTransfer = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { amount, bankCode, provider, accountNumber, accountName, pin } =
        req.body;
      const result = await this.withdrawalService.bankTransfer({
        userId,
        amount,
        accountNumber,
        accountName,
        bankCode,
        provider,
      });
      return sendSuccessResponse(
        res,
        result,
        "Bank transfer initiated successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
