import { Request, Response } from "express";
import { SystemBankAccountService } from "@/services/admin/SystemBankAccountService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class SystemBankAccountController {
  private bankAccountService: SystemBankAccountService;

  constructor() {
    this.bankAccountService = new SystemBankAccountService();
  }

  listBankAccounts = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.bankAccountService.listBankAccounts(
        Number(page),
        Number(limit)
      );
      return sendSuccessResponse(
        res,
        result,
        "Bank accounts retrieved successfully"
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  createBankAccount = async (req: Request, res: Response) => {
    try {
      const result = await this.bankAccountService.createBankAccount(req.body);
      return sendSuccessResponse(
        res,
        result,
        result.message,
        HTTP_STATUS.CREATED
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  updateBankAccountStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await this.bankAccountService.updateBankAccountStatus(
        id,
        status
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  deleteBankAccount = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.bankAccountService.deleteBankAccount(id);
      return sendSuccessResponse(res, null, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
