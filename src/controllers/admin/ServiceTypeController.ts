import { Request, Response, NextFunction } from 'express';
import { ServiceTypeService } from '@/services/admin/ServiceTypeService';

export class ServiceTypeController {
  private serviceTypeService: ServiceTypeService;

  constructor() {
    this.serviceTypeService = new ServiceTypeService();
  }

  listServiceTypes = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, status, search } = req.query;
      const result = await this.serviceTypeService.listServiceTypes(
        Number(page),
        Number(limit),
        { status, search }
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createServiceType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.serviceTypeService.createServiceType(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getServiceTypeDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const serviceType = await this.serviceTypeService.getServiceTypeDetails(id);
      res.json(serviceType);
    } catch (error) {
      next(error);
    }
  };

  updateServiceType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.serviceTypeService.updateServiceType(id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteServiceType = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.serviceTypeService.deleteServiceType(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
