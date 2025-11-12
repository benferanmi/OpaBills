import { Response } from "express";
import { WithdrawalManagementService } from "@/services/admin/WithdrawalManagementService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";
import { AuthenticatedAdminRequest } from "@/middlewares/admin/adminAuth";

export class WithdrawalManagementController {
  private withdrawalService: WithdrawalManagementService;

  constructor() {
    this.withdrawalService = new WithdrawalManagementService();
  }

  listWithdrawals = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.withdrawalService.listWithdrawals(
        Number(page),
        Number(limit),
        filters
      );
      return sendSuccessResponse(
        res,
        result,

        "Withdrawals retrieved successfully"
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getWithdrawalDetails = async (
    req: AuthenticatedAdminRequest,
    res: Response
  ) => {
    try {
      const { id } = req.params;
      const result = await this.withdrawalService.getWithdrawalDetails(id);
      return sendSuccessResponse(res, result, "Withdrawal details retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  approveWithdrawal = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.withdrawalService.approveWithdrawal(
        id,
        req.admin._id.toString()
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  declineWithdrawal = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await this.withdrawalService.declineWithdrawal(
        id,
        reason,
        req.admin._id.toString()
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  processWithdrawal = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { transactionId, provider } = req.body;
      const result = await this.withdrawalService.processWithdrawal(
        id,
        provider,
        transactionId
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
