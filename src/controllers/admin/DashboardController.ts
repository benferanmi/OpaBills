import { Request, Response } from "express";
import { DashboardService } from "@/services/admin/DashboardService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class AdminDashboardController {
  private dashboardService: DashboardService;

  constructor() {
    this.dashboardService = new DashboardService();
  }

  getDashboardStats = async (req: Request, res: Response) => {
    try {
      const result = await this.dashboardService.getDashboardStats();
      return sendSuccessResponse(res, result, "Dashboard stats retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getRevenueChart = async (req: Request, res: Response) => {
    try {
      const { days = 30 } = req.query;
      const result = await this.dashboardService.getRevenueChart(Number(days));
      return sendSuccessResponse(res, result, "Revenue chart retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getTransactionTypeDistribution = async (req: Request, res: Response) => {
    try {
      const result =
        await this.dashboardService.getTransactionTypeDistribution();
      return sendSuccessResponse(
        res,
        result,
        "Transaction distribution retrieved"
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
