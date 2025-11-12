import { Request, Response, NextFunction } from 'express';
import { RouteActionService } from '@/services/admin/RouteActionService';

export class RouteActionController {
  private routeActionService: RouteActionService;

  constructor() {
    this.routeActionService = new RouteActionService();
  }

  listRouteActions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page = 1, limit = 20, module, status } = req.query;
      const result = await this.routeActionService.listRouteActions(
        Number(page),
        Number(limit),
        { module, status }
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  createRouteAction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.routeActionService.createRouteAction(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  };

  getRouteActionDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const routeAction = await this.routeActionService.getRouteActionDetails(id);
      res.json(routeAction);
    } catch (error) {
      next(error);
    }
  };

  updateRouteAction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.routeActionService.updateRouteAction(id, req.body);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteRouteAction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await this.routeActionService.deleteRouteAction(id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getRoutesByRole = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { roleId } = req.params;
      const routes = await this.routeActionService.getRoutesByRole(roleId);
      res.json({ routes });
    } catch (error) {
      next(error);
    }
  };
}
