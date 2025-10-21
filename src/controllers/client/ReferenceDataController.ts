import { Request, Response, NextFunction } from 'express';
import { ReferenceDataService } from '@/services/client/ReferenceDataService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';

export class ReferenceDataController {
  constructor(private referenceDataService: ReferenceDataService) {}

  // Countries
  getAllCountries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await this.referenceDataService.getAllCountries(page, limit);
      return sendPaginatedResponse(
        res,
        result.countries,
        { total: result.total, page, limit },
        'Countries retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getCountryById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const country = await this.referenceDataService.getCountryById(req.params.id);
      return sendSuccessResponse(res, country, 'Country retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  searchCountries = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await this.referenceDataService.searchCountries(query, page, limit);
      return sendPaginatedResponse(
        res,
        result.countries,
        { total: result.total, page, limit },
        'Countries found'
      );
    } catch (error) {
      next(error);
    }
  };

  // States
  getStatesByCountry = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await this.referenceDataService.getStatesByCountry(req.params.countryId, page, limit);
      return sendPaginatedResponse(
        res,
        result.states,
        { total: result.total, page, limit },
        'States retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getStateById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const state = await this.referenceDataService.getStateById(req.params.id);
      return sendSuccessResponse(res, state, 'State retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  // Cities
  getCitiesByState = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await this.referenceDataService.getCitiesByState(req.params.stateId, page, limit);
      return sendPaginatedResponse(
        res,
        result.cities,
        { total: result.total, page, limit },
        'Cities retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getCityById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const city = await this.referenceDataService.getCityById(req.params.id);
      return sendSuccessResponse(res, city, 'City retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  // Providers
  getProviders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productType = req.query.productType as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await this.referenceDataService.getProviders(productType, page, limit);
      return sendPaginatedResponse(
        res,
        result.providers,
        { total: result.total, page, limit },
        'Providers retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getProviderById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const provider = await this.referenceDataService.getProviderById(req.params.id);
      return sendSuccessResponse(res, provider, 'Provider retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  // Services
  getServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productType = req.query.productType as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await this.referenceDataService.getServices(productType, page, limit);
      return sendPaginatedResponse(
        res,
        result.services,
        { total: result.total, page, limit },
        'Services retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getServiceById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const service = await this.referenceDataService.getServiceById(req.params.id);
      return sendSuccessResponse(res, service, 'Service retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  // Products
  getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filters = {
        providerId: req.query.providerId as string,
        serviceId: req.query.serviceId as string,
        productType: req.query.productType as string,
        dataType: req.query.dataType as string,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 50,
      };
      const result = await this.referenceDataService.getProducts(filters);
      return sendPaginatedResponse(
        res,
        result.products,
        { total: result.total, page: filters.page, limit: filters.limit },
        'Products retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const product = await this.referenceDataService.getProductById(req.params.id);
      return sendSuccessResponse(res, product, 'Product retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  searchProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = req.query.q as string;
      const productType = req.query.productType as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await this.referenceDataService.searchProducts(query, productType, page, limit);
      return sendPaginatedResponse(
        res,
        result.products,
        { total: result.total, page, limit },
        'Products found'
      );
    } catch (error) {
      next(error);
    }
  };

  // Banks
  getBanks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 100;
      const result = await this.referenceDataService.getBanks(page, limit);
      return sendPaginatedResponse(
        res,
        result.banks,
        { total: result.total, page, limit },
        'Banks retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };
}
