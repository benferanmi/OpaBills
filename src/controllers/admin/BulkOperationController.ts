import { Request, Response, NextFunction } from 'express';
import { BulkOperationService } from '@/services/admin/BulkOperationService';

export class BulkOperationController {
  private bulkOperationService: BulkOperationService;

  constructor() {
    this.bulkOperationService = new BulkOperationService();
  }

  bulkUpdateUserStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds, status } = req.body;
      const result = await this.bulkOperationService.bulkUpdateUserStatus(userIds, status);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  bulkSendNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds, notification } = req.body;
      const result = await this.bulkOperationService.bulkSendNotification(userIds, notification);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  bulkUpdateTransactionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { transactionIds, status } = req.body;
      const adminId = (req as any).admin._id;
      const result = await this.bulkOperationService.bulkUpdateTransactionStatus(
        transactionIds,
        status,
        adminId
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  bulkDeleteUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userIds } = req.body;
      const result = await this.bulkOperationService.bulkDeleteUsers(userIds);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  exportUsersToCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.bulkOperationService.exportUsersToCsv(req.query);
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', 'attachment; filename=users.csv');
      res.send(result.csv);
    } catch (error) {
      next(error);
    }
  };

  exportTransactionsToCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.bulkOperationService.exportTransactionsToCsv(req.query);
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', 'attachment; filename=transactions.csv');
      res.send(result.csv);
    } catch (error) {
      next(error);
    }
  };

  bulkImportUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { users } = req.body;
      const result = await this.bulkOperationService.bulkImportUsers(users);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
