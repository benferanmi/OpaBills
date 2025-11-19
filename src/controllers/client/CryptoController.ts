import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { CryptoService } from "@/services/client/CryptoService";
import { sendSuccessResponse, sendPaginatedResponse } from "@/utils/helpers";

export class CryptoController {
  private cryptoService: CryptoService;

  constructor() {
    this.cryptoService = new CryptoService();
  }

  /**
   * Get list of available cryptocurrencies
   * GET /api/cryptos
   */
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

  /**
   * Get single cryptocurrency details
   * GET /api/cryptos/:cryptoId
   */
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

  /**
   * Get available networks for a cryptocurrency
   * GET /api/cryptos/:cryptoId/networks
   */
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

  /**
   * Get current exchange rates for all cryptos
   * GET /api/cryptos/rates
   */
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

  /**
   * Calculate transaction breakdown before initiating
   * POST /api/cryptos/calculate-breakdown
   */
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

  /**
   * Initiate crypto purchase (BUY)
   * POST /api/cryptos/buy
   */
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

  /**
   * Initiate crypto sale (SELL)
   * POST /api/cryptos/sell
   */
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

  /**
   * Get user's crypto transactions with filters
   * GET /api/crypto-transactions
   */
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

  /**
   * Get single transaction by ID
   * GET /api/crypto-transactions/:transactionId
   */
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

  /**
   * Get transaction by reference
   * GET /api/crypto-transactions/reference/:reference
   */
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

  /**
   * Get transaction statistics for user
   * GET /api/crypto-transactions/stats
   */
  getCryptoTransactionStats = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;

      // Get all transactions
      const allTransactions = await this.cryptoService.getCryptoTransactions(
        userId,
        {},
        1,
        1000
      );

      const transactions = allTransactions.data;

      // Calculate stats
      const stats = {
        total: transactions.length,
        pending: transactions.filter((t: any) => t.status === "pending").length,
        processing: transactions.filter((t: any) => t.status === "processing")
          .length,
        approved: transactions.filter((t: any) => t.status === "approved")
          .length,
        success: transactions.filter((t: any) => t.status === "success").length,
        failed: transactions.filter((t: any) => t.status === "failed").length,
        declined: transactions.filter((t: any) => t.status === "declined")
          .length,

        totalBuy: transactions.filter((t: any) => t.tradeType === "buy").length,
        totalSell: transactions.filter((t: any) => t.tradeType === "sell")
          .length,

        totalBuyAmount: transactions
          .filter((t: any) => t.tradeType === "buy" && t.status === "success")
          .reduce((sum: number, t: any) => sum + t.totalAmount, 0),

        totalSellAmount: transactions
          .filter((t: any) => t.tradeType === "sell" && t.status === "success")
          .reduce((sum: number, t: any) => sum + t.totalAmount, 0),
      };

      return sendSuccessResponse(
        res,
        stats,
        "Transaction statistics retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get pending transactions for user
   * GET /api/crypto-transactions/pending
   */
  getPendingCryptoTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.cryptoService.getCryptoTransactions(
        userId,
        { status: "pending" },
        page,
        limit
      );

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Pending transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get completed transactions for user
   * GET /api/crypto-transactions/completed
   */
  getCompletedCryptoTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.cryptoService.getCryptoTransactions(
        userId,
        { status: "success" },
        page,
        limit
      );

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Completed transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
