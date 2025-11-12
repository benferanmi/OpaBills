import { Request, Response, NextFunction } from 'express';
import { AppVersionService } from '@/services/admin/AppVersionService';

export class AppVersionController {
  private appVersionService: AppVersionService;

  constructor() {
    this.appVersionService = new AppVersionService();
  }

  listAppVersions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.appVersionService.listAppVersions(
        Number(page),
        Number(limit)
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createAppVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.appVersionService.createAppVersion(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getAppVersionDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const appVersion = await this.appVersionService.getAppVersionDetails(id);
      res.json(appVersion);
    } catch (error) {
      next(error);
    }
  };

  updateAppVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.appVersionService.updateAppVersion(id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteAppVersion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.appVersionService.deleteAppVersion(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
