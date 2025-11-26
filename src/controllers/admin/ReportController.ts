import { Request, Response, NextFunction } from 'express';
import { ReportService } from '@/services/admin/ReportService';

export class ReportController {
  private reportService: ReportService;

  constructor() {
    this.reportService = new ReportService();
  }

  getRevenueReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const report = await this.reportService.getRevenueReport(start, end);
      res.json(report);
    } catch (error) {
      next(error);
    }
  };

  getUserGrowthReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const report = await this.reportService.getUserGrowthReport(start, end);
      res.json(report);
    } catch (error) {
      next(error);
    }
  };

  getTransactionSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const report = await this.reportService.getTransactionSummary(start, end);
      res.json(report);
    } catch (error) {
      next(error);
    }
  };


  getCryptoGiftCardReport = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate } = req.query;
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const report = await this.reportService.getCryptoGiftCardReport(start, end);
      res.json(report);
    } catch (error) {
      next(error);
    }
  };

  getTopUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, limit = 10 } = req.query;
      const start = new Date(startDate as string);
      const end = new Date(endDate as string);
      
      const report = await this.reportService.getTopUsers(start, end, Number(limit));
      res.json(report);
    } catch (error) {
      next(error);
    }
  };
}
