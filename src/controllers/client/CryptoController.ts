import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { CryptoService } from "@/services/client/CryptoService";
import { sendSuccessResponse, sendPaginatedResponse } from "@/utils/helpers";

export class CryptoController {
  private cryptoService: CryptoService;

  constructor() {
    this.cryptoService = new CryptoService();
  }

  // Get list of available cryptocurrencies
  getCryptos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      let filters = {};

      if (req.query.saleActivated !== undefined) {
        filters = {
          ...filters,
          saleActivated: req.query.saleActivated === "true",
        };
      }
      if (req.query.purchaseActivated !== undefined) {
        filters = {
          ...filters,
          purchaseActivated: req.query.purchaseActivated === "true",
        };
      }
      if (req.query.search) {
        filters = { ...filters, search: req.query.search as string };
      }

      const result = await this.cryptoService.getCryptos(filters, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Cryptocurrencies retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  // Get single cryptocurrency details
  getCryptoById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { cryptoId } = req.params;
      const crypto = await this.cryptoService.getCryptoById(cryptoId);

      return sendSuccessResponse(
        res,
        crypto,
        "Cryptocurrency retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  // Get available networks for a cryptocurrency
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
        "Networks retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  // Get current exchange rates for all cryptos
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

  // Calculate transaction breakdown before initiating
  calculateBreakdown = async (
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

  // Initiate crypto purchase (BUY)
  buyCrypto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const data = { ...req.body, userId };

      const result = await this.cryptoService.buyCrypto(data);

      return sendSuccessResponse(
        res,
        result,
        "Crypto purchase initiated successfully. Your transaction is being processed."
      );
    } catch (error) {
      next(error);
    }
  };

  // Initiate crypto sale (SELL)
  sellCrypto = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const data = { ...req.body, userId };

      const result = await this.cryptoService.sellCrypto(data);

      return sendSuccessResponse(
        res,
        result,
        "Crypto sale request submitted successfully. Please send the crypto to the provided address."
      );
    } catch (error) {
      next(error);
    }
  };

  // Get user's crypto transactions with filters
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
        cryptoId: req.query.cryptoId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        reference: req.query.reference as string,
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

  // Get single transaction by ID
  getCryptoTransactionById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { transactionId } = req.params;

      const transaction = await this.cryptoService.getCryptoTransactionById(
        transactionId,
        userId
      );

      return sendSuccessResponse(
        res,
        transaction,
        "Transaction retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  // Get transaction by reference
  getCryptoTransactionByReference = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { reference } = req.params;

      const transaction =
        await this.cryptoService.getCryptoTransactionByReference(
          reference,
          userId
        );

      return sendSuccessResponse(
        res,
        transaction,
        "Transaction retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };


  exportCryptoTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;

      const filters = {
        tradeType: req.query.tradeType as string,
        status: req.query.status as string,
        cryptoId: req.query.cryptoId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const csvData = await this.cryptoService.exportCryptoTransactions(
        userId,
        filters
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=crypto_transactions_${
          new Date().toISOString().split("T")[0]
        }.csv`
      );

      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  };

  generateCryptoReceipt = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const userId = req.user!.id;

      const receipt = await this.cryptoService.generateCryptoReceipt(
        reference,
        userId
      );

      return sendSuccessResponse(
        res,
        receipt,
        "Receipt generated successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  uploadTransactionProof = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const userId = req.user!.id;
      const { proof } = req.body;

      const transaction = await this.cryptoService.uploadTransactionProof(
        reference,
        userId,
        proof
      );

      return sendSuccessResponse(
        res,
        transaction,
        "Proof uploaded successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
