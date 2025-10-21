import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { NotificationService } from '@/services/client/NotificationService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  getUserNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const result = await this.notificationService.getUserNotifications(userId, page, limit);
      
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Notifications retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getUnreadNotifications = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const notifications = await this.notificationService.getUnreadNotifications(userId);
      return sendSuccessResponse(res, notifications, 'Unread notifications retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const count = await this.notificationService.getUnreadCount(userId);
      return sendSuccessResponse(res, { count }, 'Unread count retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const notification = await this.notificationService.markAsRead(id);
      return sendSuccessResponse(res, notification, 'Notification marked as read');
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      await this.notificationService.markAllAsRead(userId);
      return sendSuccessResponse(res, null, 'All notifications marked as read');
    } catch (error) {
      next(error);
    }
  };
}
