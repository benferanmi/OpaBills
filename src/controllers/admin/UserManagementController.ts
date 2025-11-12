import { Request, Response } from "express";
import { UserManagementService } from "@/services/admin/UserManagementService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class UserManagementController {
  private userService: UserManagementService;

  constructor() {
    this.userService = new UserManagementService();
  }

  listUsers = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.userService.listUsers(
        Number(page),
        Number(limit),
        filters
      );
      return sendSuccessResponse(res, "Users retrieveresult,d successfully");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getUserDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.userService.getUserDetails(id);
      return sendSuccessResponse(res, "User detresult,ails retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateUserStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await this.userService.updateUserStatus(id, status);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  markAsFraudulent = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await this.userService.markUserAsFraudulent(id, reason);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  manageWallet = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { action, amount, type, remark } = req.body;

      if (action === "credit") {
        const result = await this.userService.creditUserWallet(
          id,
          amount,
          type,
          remark
        );
        return sendSuccessResponse(res, result, result.message);
      } else if (action === "debit") {
        const result = await this.userService.debitUserWallet(
          id,
          amount,
          type,
          remark
        );
        return sendSuccessResponse(res, result, result.message);
      } else {
        return sendErrorResponse(
          res,
          "Invalid action",
          HTTP_STATUS.BAD_REQUEST
        );
      }
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
