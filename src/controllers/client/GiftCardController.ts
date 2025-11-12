import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { GiftCardService } from "@/services/client/GiftCardService";
import { sendSuccessResponse, sendPaginatedResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class GiftCardController {
  private giftCardService: GiftCardService;

  constructor() {
    this.giftCardService = new GiftCardService();
  }

  getCategories = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const page = parseInt(req.params.page as string) || 1;
      const limit = parseInt(req.params.limit as string) || 10;
      const type = req.params.type as "both" | "sell" | "buy";
      const result = await this.giftCardService.getCategories(
        page,
        limit,
        type
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Gift card categories retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getCategoryById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { categoryId } = req.params;
      const category = await this.giftCardService.getCategoryById(categoryId);
      return sendSuccessResponse(
        res,
        category,
        "Category retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getGiftCards = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      console.log("called");
      const page = parseInt(req.params.page as string) || 1;
      const limit = parseInt(req.params.limit as string) || 10;

      const { categoryId, countryId, search, type } = req.body;

      let filters = {};
      if (categoryId) filters = { ...filters, categoryId };
      if (countryId) filters = { ...filters, countryId };
      if (search) filters = { ...filters, search };
      if (type) filters = { ...filters, type };

      const filter = {
        categoryId,
        countryId,
        search,
        type,
      };

      const result = await this.giftCardService.getGiftCards(
        filters,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Gift cards retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getGiftCardById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { giftCardId } = req.params;
      const giftCard = await this.giftCardService.getGiftCardById(giftCardId);
      return sendSuccessResponse(
        res,
        giftCard,
        "Gift card retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getGiftCardDenominations = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { giftCardId } = req.params;
      const denominations =
        await this.giftCardService.getAvailableDenominations(giftCardId);
      return sendSuccessResponse(
        res,
        denominations,
        "Gift card denominations retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getGiftCardsByType = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { type } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const result = await this.giftCardService.getGiftCardsByType(
        type,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Gift cards retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getRates = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const rates = await this.giftCardService.getGiftCardRates();
      return sendSuccessResponse(
        res,
        rates,
        "Gift card rates retrieved successfully"
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
      const breakdown = await this.giftCardService.calculateBreakdown(req.body);
      return sendSuccessResponse(
        res,
        breakdown,
        "Breakdown calculated successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  buyGiftCard = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const user = req.userData!;

      const { giftCardId, amount, quantity } = req.body;
      const result = await this.giftCardService.buyGiftCard({
        giftCardId,
        amount,
        quantity,
        userId,
        user,
      });
      return sendSuccessResponse(
        res,
        result,
        "Gift card purchase initiated",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  sellGiftCard = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const result = await this.giftCardService.sellGiftCard({
        ...req.body,
        userId,
      });
      return sendSuccessResponse(
        res,
        result,
        "Gift card sale submitted for approval",
        HTTP_STATUS.CREATED
      );
    } catch (error) {
      next(error);
    }
  };

  getRedeemCode = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { transactionId } = req.params;
      const redeemCode = await this.giftCardService.getRedeemCode(
        transactionId,
        userId
      );
      return sendSuccessResponse(
        res,
        redeemCode,
        "Redeem code retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getGiftCardTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        tradeType: req.query.tradeType,
        status: req.query.status,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
      };
      const result = await this.giftCardService.getGiftCardTransactions(
        userId,
        filters,
        page,
        limit
      );
      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Gift card transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getGiftCardTransactionById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { transactionId } = req.params;
      const transaction = await this.giftCardService.getGiftCardTransactionById(
        transactionId
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

  getGiftCardTransactionByReference = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const transaction =
        await this.giftCardService.getGiftCardTransactionByReference(reference);
      return sendSuccessResponse(
        res,
        transaction,
        "Transaction retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
