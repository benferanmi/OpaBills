import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { BillPaymentService } from '@/services/client/BillPaymentService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';
import { HTTP_STATUS } from '@/utils/constants';

export class BillPaymentController {
  private billPaymentService: BillPaymentService
  constructor() {
    this.billPaymentService = new BillPaymentService();
  }

  purchaseAirtime = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseAirtime({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'Airtime purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  purchaseData = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseData({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'Data purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  purchaseCableTv = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseCableTv({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'Cable TV subscription initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  purchaseElectricity = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseElectricity({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(res, result, 'Electricity payment initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  getBillPaymentTransactions = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        type: req.query.type,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };

      const result = await this.billPaymentService.getBillPaymentTransactions(userId, filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Bill payment transactions retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  // Airtime methods
  getAirtimeProviders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const providers = await this.billPaymentService.getAirtimeProviders();
      return sendSuccessResponse(res, providers, 'Airtime providers retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  verifyPhone = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.billPaymentService.verifyPhone(req.body.phone);
      return sendSuccessResponse(res, result, 'Phone verified successfully');
    } catch (error) {
      next(error);
    }
  };

  getAirtimeHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getAirtimeHistory(userId, page, limit);
      return sendPaginatedResponse(res, result.data, { total: result.total, page, limit }, 'Airtime history retrieved');
    } catch (error) {
      next(error);
    }
  };

  bulkPurchaseAirtime = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.bulkPurchaseAirtime({ ...req.body, userId });
      return sendSuccessResponse(res, result, 'Bulk airtime purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  // Data methods
  getDataServices = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { type } = req.params;
      const services = await this.billPaymentService.getDataServices(type);
      return sendSuccessResponse(res, services, 'Data services retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getDataProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { type, service } = req.params;
      const products = await this.billPaymentService.getDataProducts(type, service);
      return sendSuccessResponse(res, products, 'Data products retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getDataHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getDataHistory(userId, page, limit);
      return sendPaginatedResponse(res, result.data, { total: result.total, page, limit }, 'Data history retrieved');
    } catch (error) {
      next(error);
    }
  };

  bulkPurchaseData = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.bulkPurchaseData({ ...req.body, userId });
      return sendSuccessResponse(res, result, 'Bulk data purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  // Betting methods
  getBettingProviders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const providers = await this.billPaymentService.getBettingProviders();
      return sendSuccessResponse(res, providers, 'Betting providers retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  verifyBettingAccount = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.billPaymentService.verifyBettingAccount(req.body);
      return sendSuccessResponse(res, result, 'Betting account verified successfully');
    } catch (error) {
      next(error);
    }
  };

  fundBetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.fundBetting({ ...req.body, userId });
      return sendSuccessResponse(res, result, 'Betting account funded successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  getBettingHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getBettingHistory(userId, page, limit);
      return sendPaginatedResponse(res, result.data, { total: result.total, page, limit }, 'Betting history retrieved');
    } catch (error) {
      next(error);
    }
  };

  // E-Pin methods
  getEPinServices = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const services = await this.billPaymentService.getEPinServices();
      return sendSuccessResponse(res, services, 'E-Pin services retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getEPinProducts = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { service } = req.params;
      const products = await this.billPaymentService.getEPinProducts(service);
      return sendSuccessResponse(res, products, 'E-Pin products retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  verifyEPinMerchant = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.billPaymentService.verifyEPinMerchant(req.body);
      return sendSuccessResponse(res, result, 'E-Pin merchant verified successfully');
    } catch (error) {
      next(error);
    }
  };

  purchaseEPin = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const result = await this.billPaymentService.purchaseEPin({ ...req.body, userId });
      return sendSuccessResponse(res, result, 'E-Pin purchase initiated', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  };

  getEPinHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getEPinHistory(userId, page, limit);
      return sendPaginatedResponse(res, result.data, { total: result.total, page, limit }, 'E-Pin history retrieved');
    } catch (error) {
      next(error);
    }
  };

  // Electricity methods
  getElectricityProviders = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const providers = await this.billPaymentService.getElectricityProviders();
      return sendSuccessResponse(res, providers, 'Electricity providers retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  verifyMeterNumber = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.billPaymentService.verifyMeterNumber(req.body);
      return sendSuccessResponse(res, result, 'Meter number verified successfully');
    } catch (error) {
      next(error);
    }
  };

  getElectricityHistory = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getElectricityHistory(userId, page, limit);
      return sendPaginatedResponse(res, result.data, { total: result.total, page, limit }, 'Electricity history retrieved');
    } catch (error) {
      next(error);
    }
  };
}
