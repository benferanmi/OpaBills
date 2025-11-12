import { Request, Response, NextFunction } from 'express';
import { DiscountService } from '@/services/admin/DiscountService';

export class DiscountController {
  private discountService: DiscountService;

  constructor() {
    this.discountService = new DiscountService();
  }

  listDiscounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, serviceId, status, code } = req.query;
      const result = await this.discountService.listDiscounts(
        Number(page),
        Number(limit),
        { serviceId, status, code }
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createDiscount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.discountService.createDiscount(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getDiscountDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const discount = await this.discountService.getDiscountDetails(id);
      res.json(discount);
    } catch (error) {
      next(error);
    }
  };

  updateDiscount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.discountService.updateDiscount(id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteDiscount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.discountService.deleteDiscount(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}
