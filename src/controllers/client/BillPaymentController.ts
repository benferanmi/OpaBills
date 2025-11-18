import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { BillPaymentService } from "@/services/client/BillPaymentService";
import { sendSuccessResponse, sendPaginatedResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class BillPaymentController {
  private billPaymentService: BillPaymentService;
  constructor() {
    this.billPaymentService = new BillPaymentService();
  }

  purchaseAirtime = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { phone, amount, provider } = req.body;
      const result = await this.billPaymentService.purchaseAirtime({
        phone,
        network: provider,
        amount,
        userId,
      });
      return sendSuccessResponse(
        res,
        result,
        "Airtime purchase initiated",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  purchaseData = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { phone, productId } = req.body;
      const result = await this.billPaymentService.purchaseData({
        phone,
        productId,
        userId,
      });
      return sendSuccessResponse(
        res,
        result,
        "Data purchase initiated",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  purchaseCableTv = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const user = req.userData!;
      const { provider, number, type, productId } = req.body;
      const result = await this.billPaymentService.purchaseCableTv({
        userId,
        user,
        provider,
        smartCardNumber: number,
        type,
        productId,
      });
      return sendSuccessResponse(
        res,
        result,
        "Cable TV subscription initiated",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  purchaseElectricity = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const phone = req.userData?.phone;

      if (!phone) {
        return sendSuccessResponse(
          res,
          null,
          "Kindly Update your Phone Number",
          HTTP_STATUS.NOT_FOUND
        );
      }
      const { providerId, type, number, amount } = req.body;
      const result = await this.billPaymentService.purchaseElectricity({
        providerId,
        meterType: type,
        meterNumber: number,
        amount,
        userId,
        phone,
      });
      return sendSuccessResponse(
        res,
        result,
        "Electricity payment initiated",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  getBillPaymentTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
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

      const result = await this.billPaymentService.getBillPaymentTransactions(
        userId,
        filters,
        page,
        limit
      );

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Bill payment transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  // Airtime methods
  getAirtimeProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const providers = await this.billPaymentService.getAirtimeProviders();
      return sendSuccessResponse(
        res,
        providers,
        "Airtime providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  verifyPhone = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const result = await this.billPaymentService.verifyPhone(req.body.phone);
      return sendSuccessResponse(res, result, "Phone verified successfully");
    } catch (error) {
      next(error);
    }
  };

  verifyPhoneWithNetwork = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { phone, network } = req.body;
      const isValid = await this.billPaymentService.verifyPhoneWithNetwork(
        phone,
        network
      );
      return sendSuccessResponse(
        res,
        { isValid },
        "Phone and network verification completed"
      );
    } catch (error) {
      next(error);
    }
  };

  getAirtimeHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getAirtimeHistory(
        userId,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Airtime history retrieved"
      );
    } catch (error) {
      next(error);
    }
  };

  // International Airtime methods
  getInternationalAirtimeCountries = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const countries =
        await this.billPaymentService.getInternationalAirtimeCountries();
      return sendSuccessResponse(
        res,
        countries,
        "International airtime countries retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getInternationalAirtimeProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { countryCode } = req.params;
      const providers =
        await this.billPaymentService.getInternationalAirtimeProviders(
          countryCode
        );
      return sendSuccessResponse(
        res,
        providers,
        "International airtime providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getInternationalAirtimeProducts = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { providerId } = req.params;
      const productTypeId = 1;
      const products =
        await this.billPaymentService.getInternationalAirtimeProducts(
          providerId,
          productTypeId
        );
      return sendSuccessResponse(
        res,
        products,
        "International airtime products retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  purchaseInternationalAirtime = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { phone, amount, productCode, countryCode, operatorId } = req.body;
      const email = req.user!.email;
      const result = await this.billPaymentService.purchaseInternationalAirtime(
        {
          userId,
          phone,
          amount,
          countryCode,
          productCode,
          operatorId,
          email,
        }
      );
      return sendSuccessResponse(
        res,
        result,
        "International airtime purchase initiated",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  getInternationalAirtimeHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result =
        await this.billPaymentService.getInternationalAirtimeHistory(
          userId,
          page,
          limit
        );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "International airtime history retrieved"
      );
    } catch (error) {
      next(error);
    }
  };

  //Data methods
  getDataProducts = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { providerId } = req.params;
      const products = await this.billPaymentService.getDataProducts(
        providerId
      );
      return sendSuccessResponse(
        res,
        products,
        "Data products retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getDataProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const providers = await this.billPaymentService.getDataProviders();
      return sendSuccessResponse(
        res,
        providers,
        "Airtime providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getData = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.billPaymentService.getData();
      return sendSuccessResponse(res, data, "Data retrieved successfully");
    } catch (error) {
      next(error);
    }
  };

  getDataHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getDataHistory(
        userId,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Data history retrieved"
      );
    } catch (error) {
      next(error);
    }
  };

  // International Data methods
  getInternationalDataCountries = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const countries =
        await this.billPaymentService.getInternationalDataCountries();
      return sendSuccessResponse(
        res,
        countries,
        "International data countries retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getInternationalDataProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { countryCode } = req.params;
      const providers =
        await this.billPaymentService.getInternationalDataProviders(
          countryCode
        );
      return sendSuccessResponse(
        res,
        providers,
        "International data providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getInternationalDataProducts = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { providerId } = req.params;
      const products =
        await this.billPaymentService.getInternationalDataProducts(providerId);
      return sendSuccessResponse(
        res,
        products,
        "International data products retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  purchaseInternationalData = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { phone, amount, productCode, countryCode, operatorId } = req.body;
      const email = req.user!.email;
      const result = await this.billPaymentService.purchaseInternationalData({
        userId,
        phone,
        amount,
        countryCode,
        productCode,
        operatorId,
        email,
      });
      return sendSuccessResponse(
        res,
        result,
        "International data purchase initiated",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  getInternationalDataHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getInternationalDataHistory(
        userId,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "International data history retrieved"
      );
    } catch (error) {
      next(error);
    }
  };

  // TV methods
  getTvPackages = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { providerId } = req.params;
      const products = await this.billPaymentService.getCableTvProducts(
        providerId
      );
      return sendSuccessResponse(
        res,
        products,
        "Tv Packages retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getTvProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const providers = await this.billPaymentService.getCableTvProviders();
      return sendSuccessResponse(
        res,
        providers,
        "Tv providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  verifySmartCardNumber = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { number, provider } = req.body;
      const result = await this.billPaymentService.verifyCableSmartCard(
        number,
        provider
      );

      return sendSuccessResponse(
        res,
        result,
        "Smart card Number Verified Successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  // Betting methods
  getBettingProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const providers = await this.billPaymentService.getBettingProviders();
      return sendSuccessResponse(
        res,
        providers,
        "Betting providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  verifyBettingAccount = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { number, providerId } = req.body;
      const result = await this.billPaymentService.verifyBettingAccount({
        customerId: number,
        providerId,
      });
      return sendSuccessResponse(
        res,
        result,
        "Betting account verified successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  fundBetting = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { providerId, amount, number } = req.body;
      const result = await this.billPaymentService.fundBetting({
        userId,
        customerId: number,
        providerId,
        amount,
      });
      return sendSuccessResponse(
        res,
        result,
        "Betting account funded successfully",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  getBettingHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getBettingHistory(
        userId,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Betting history retrieved"
      );
    } catch (error) {
      next(error);
    }
  };

  // E-Pin methods
  getEPinServices = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const services = await this.billPaymentService.getEPinServices();
      return sendSuccessResponse(
        res,
        services,
        "E-Pin services retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getEPinProducts = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { service } = req.params;
      const products = await this.billPaymentService.getEPinProducts(service);
      return sendSuccessResponse(
        res,
        products,
        "E-Pin products retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  verifyEPinMerchant = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { number, type } = req.body;
      const result = await this.billPaymentService.verifyEPinProfile({
        number,
        type,
      });
      return sendSuccessResponse(
        res,
        result,
        "E-Pin merchant verified successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  purchaseEPin = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { productId, number } = req.body;
      const user = req.userData!;
      const result = await this.billPaymentService.purchaseEPin({
        productId,
        profileId: number,
        user,
        userId,
      });
      return sendSuccessResponse(
        res,
        result,
        "E-Pin purchase initiated",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  getEPinHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getEPinHistory(
        userId,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "E-Pin history retrieved"
      );
    } catch (error) {
      next(error);
    }
  };

  // Electricity methods
  getElectricityProviders = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const providers = await this.billPaymentService.getElectricityProviders();
      return sendSuccessResponse(
        res,
        providers,
        "Electricity providers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  verifyMeterNumber = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { providerCode, type, number } = req.body;
      const result = await this.billPaymentService.verifyMeterNumber({
        serviceCode: providerCode,
        meterType: type,
        meterNumber: number,
      });
      return sendSuccessResponse(
        res,
        result,
        "Meter number verified successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getElectricityHistory = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const result = await this.billPaymentService.getElectricityHistory(
        userId,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Electricity history retrieved"
      );
    } catch (error) {
      next(error);
    }
  };
}
