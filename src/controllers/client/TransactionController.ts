import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { TransactionService } from "@/services/TransactionService";
import { sendSuccessResponse, sendPaginatedResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class TransactionController {
  private transactionService: TransactionService;
  constructor() {
    this.transactionService = new TransactionService();
  }

  createTransaction = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const transaction = await this.transactionService.createTransaction({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(
        res,
        transaction,
        "Transaction created successfully",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  getTransaction = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const transaction = await this.transactionService.getTransaction(
        reference
      );
      return sendSuccessResponse(
        res,
        transaction,
        "Transaction retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getUserTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.transactionService.getUserTransactions(
        userId,
        page,
        limit
      );

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
