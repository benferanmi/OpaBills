import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { DashboardService } from '@/services/client/DashboardService';
import { sendSuccessResponse } from '@/utils/helpers';

export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  getDashboardStats = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const stats = await this.dashboardService.getDashboardStats(userId);
      return sendSuccessResponse(res, stats, 'Dashboard stats retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getRecentActivity = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 10;
      const activities = await this.dashboardService.getRecentActivity(userId, limit);
      return sendSuccessResponse(res, activities, 'Recent activity retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getQuickActions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const actions = await this.dashboardService.getQuickActions(userId);
      return sendSuccessResponse(res, actions, 'Quick actions retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getTransactionChartData = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;
      const chartData = await this.dashboardService.getTransactionChartData(userId, days);
      return sendSuccessResponse(res, chartData, 'Transaction chart data retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getSpendingBreakdown = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const days = parseInt(req.query.days as string) || 30;
      const breakdown = await this.dashboardService.getSpendingBreakdown(userId, days);
      return sendSuccessResponse(res, breakdown, 'Spending breakdown retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}
