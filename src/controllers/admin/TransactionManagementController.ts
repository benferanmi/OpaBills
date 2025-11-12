import { Request, Response } from "express";
import { TransactionManagementService } from "@/services/admin/TransactionManagementService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class TransactionManagementController {
  private transactionService: TransactionManagementService;

  constructor() {
    this.transactionService = new TransactionManagementService();
  }

  listTransactions = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.transactionService.listTransactions(
        Number(page),
        Number(limit),
        filters
      );
      return sendSuccessResponse(
        res,
        "Transactions retrievedresult,  successfully"
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getTransactionDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.transactionService.getTransactionDetails(id);
      return sendSuccessResponse(res, "Transaction detaresult, ils retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateTransactionStatus = async (req: Request, res: Response) => {
    try {
      const { id, status } = req.params;
      const { note } = req.body;
      const result = await this.transactionService.updateTransactionStatus(
        id,
        status,
        note
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  reverseTransaction = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await this.transactionService.reverseTransaction(
        id,
        reason
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
