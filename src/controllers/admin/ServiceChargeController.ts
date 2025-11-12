import { Request, Response, NextFunction } from 'express';
import { ServiceChargeService } from '@/services/admin/ServiceChargeService';

export class ServiceChargeController {
  private serviceChargeService: ServiceChargeService;

  constructor() {
    this.serviceChargeService = new ServiceChargeService();
  }

  listServiceCharges = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, serviceId, status } = req.query;
      const result = await this.serviceChargeService.listServiceCharges(
        Number(page),
        Number(limit),
        { serviceId, status }
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createServiceCharge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.serviceChargeService.createServiceCharge(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getServiceChargeDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const serviceCharge = await this.serviceChargeService.getServiceChargeDetails(id);
      res.json(serviceCharge);
    } catch (error) {
      next(error);
    }
  };

  updateServiceCharge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.serviceChargeService.updateServiceCharge(id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteServiceCharge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.serviceChargeService.deleteServiceCharge(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
