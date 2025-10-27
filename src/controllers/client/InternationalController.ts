import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { InternationalService } from '@/services/client/InternationalService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';
import { HTTP_STATUS } from '@/utils/constants';

export class InternationalController {
  constructor(private internationalService: InternationalService) {}

  // Airtime endpoints
  getCountries = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const countries = await this.internationalService.getCountries();
      return sendSuccessResponse(res, countries, 'Countries retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getAirtimeProviders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { countryCode } = req.params;
      const providers = await this.internationalService.getProvidersByCountry(countryCode);
      return sendSuccessResponse(res, providers, 'Providers retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  purchaseInternationalAirtime = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.internationalService.purchaseInternationalAirtime({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'International airtime purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  getAirtimeHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await this.internationalService.getTransactionHistory(userId, 'airtime', filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Airtime history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  // Data endpoints
  getDataProviders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { countryCode } = req.params;
      const providers = await this.internationalService.getProvidersByCountry(countryCode);
      return sendSuccessResponse(res, providers, 'Providers retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getDataProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { operatorId } = req.params;
      const products = await this.internationalService.getDataProducts(operatorId);
      return sendSuccessResponse(res, products, 'Data products retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  purchaseInternationalData = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.internationalService.purchaseInternationalData({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'International data purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  getDataHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await this.internationalService.getTransactionHistory(userId, 'data', filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Data history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };
}
