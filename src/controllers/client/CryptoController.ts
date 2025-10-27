import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { CryptoService } from "@/services/client/CryptoService";
import { sendSuccessResponse, sendPaginatedResponse } from "@/utils/helpers";

export class CryptoController {
  private cryptoService: CryptoService;
  constructor() {
    this.cryptoService = new CryptoService();
  }

  getCryptos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        saleActivated: req.query.saleActivated === "true",
        purchaseActivated: req.query.purchaseActivated === "true",
        search: req.query.search as string,
      };

      const result = await this.cryptoService.getCryptos(filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Cryptos retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getCryptoById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { cryptoId } = req.params;
      const crypto = await this.cryptoService.getCryptoById(cryptoId);
      return sendSuccessResponse(res, crypto, "Crypto retrieved successfully");
    } catch (error) {
      next(error);
    }
  };

  buyCrypto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const data = { ...req.body, userId };
      const result = await this.cryptoService.buyCrypto(data);
      return sendSuccessResponse(
        res,
        result,
        "Crypto purchase initiated successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  sellCrypto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const data = { ...req.body, userId };
      const result = await this.cryptoService.sellCrypto(data);
      return sendSuccessResponse(
        res,
        result,
        "Crypto sale request submitted successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getCryptoTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        tradeType: req.query.tradeType as string,
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await this.cryptoService.getCryptoTransactions(
        userId,
        filters,
        page,
        limit
      );

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Crypto transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getCryptoTransactionById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { transactionId } = req.params;
      const transaction = await this.cryptoService.getCryptoTransactionById(
        transactionId
      );
      return sendSuccessResponse(
        res,
        transaction,
        "Crypto transaction retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getCryptoTransactionByReference = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const transaction =
        await this.cryptoService.getCryptoTransactionByReference(reference);
      return sendSuccessResponse(
        res,
        transaction,
        "Crypto transaction retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getCryptoRates = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const rates = await this.cryptoService.getCryptoRates();
      return sendSuccessResponse(
        res,
        rates,
        "Crypto rates retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getCryptoNetworks = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { cryptoId } = req.params;
      const networks = await this.cryptoService.getCryptoNetworks(cryptoId);
      return sendSuccessResponse(
        res,
        networks,
        "Crypto networks retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getBreakdown = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const breakdown = await this.cryptoService.calculateBreakdown(req.body);
      return sendSuccessResponse(
        res,
        breakdown,
        "Breakdown calculated successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
