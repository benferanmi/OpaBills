import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { DashboardService } from '@/services/DashboardService';
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
}
