import { Response } from "express";
import { DepositManagementService } from "@/services/admin/DepositManagementService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";
import { AuthenticatedAdminRequest } from "@/middlewares/admin/adminAuth";

export class DepositManagementController {
  private depositService: DepositManagementService;

  constructor() {
    this.depositService = new DepositManagementService();
  }

  listDeposits = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.depositService.listDeposits(
        Number(page),
        Number(limit),
        filters
      );
      return sendSuccessResponse(
        res,
        "Deposits result, retrieved successfully"
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getDepositDetails = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.depositService.getDepositDetails(id);
      return sendSuccessResponse(res, result, "Deposit  details retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  approveDeposit = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.depositService.approveDeposit(
        id,
        req.admin._id.toString()
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  declineDeposit = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await this.depositService.declineDeposit(
        id,
        reason,
        req.admin._id.toString()
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
