import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { TransactionService } from "@/services/client/TransactionService";
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
      const filters = {
        type: req.query.type,
        status: req.query.status,
        provider: req.query.provider,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const result = await this.transactionService.getUserTransactions(
        userId,
        filters,
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

  getTransactionStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const stats = await this.transactionService.getTransactionStats(userId);
      return sendSuccessResponse(
        res,
        stats,
        "Transaction stats retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getRecentTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.transactionService.getRecentTransactions(
        userId,
        limit
      );
      return sendSuccessResponse(
        res,
        result.data,
        "Recent transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  exportTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const filters = {
        type: req.query.type,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };
      const csvData = await this.transactionService.exportTransactions(
        userId,
        filters
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        "attachment; filename=transactions.csv"
      );
      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  };

  getTransactionTypes = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const types = await this.transactionService.getTransactionTypes();
      return sendSuccessResponse(
        res,
        types,
        "Transaction types retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getTransactionProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const providers = await this.transactionService.getTransactionProviders(
        userId
      );
      return sendSuccessResponse(
        res,
        providers,
        "Transaction providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  generateReceipt = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const receipt = await this.transactionService.generateReceipt(reference);
      return sendSuccessResponse(
        res,
        receipt,
        "Receipt generated successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
