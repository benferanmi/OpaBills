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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const type = req.query.type as "both" | "sell" | "buy";
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
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const { categoryId, countryId, search, type } = req.query;

      let filters: any = {};
      if (categoryId) filters.categoryId = categoryId;
      if (countryId) filters.countryId = countryId;
      if (search) filters.search = search;
      if (type) filters.type = type;

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

      const {
        giftCardId,
        amount,
        quantity,
        cardType,
        cards,
        comment,
        bankAccountId,
      } = req.body;

      const result = await this.giftCardService.sellGiftCard({
        userId,
        giftCardId,
        amount,
        quantity,
        cardType,
        cards,
        comment,
        bankAccountId,
      });

      return sendSuccessResponse(
        res,
        result,
        "Gift card submitted for review successfully",
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

  getUserTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const filters = {
        tradeType: req.query.tradeType as "buy" | "sell",
        status: req.query.status as string,
        cardType: req.query.cardType as "physical" | "ecode",
        giftCardType: req.query.giftCardType as string,
        giftCardId: req.query.giftCardId as string,
        reference: req.query.reference as string,
        groupTag: req.query.groupTag as string,
        preorder: req.query.preorder
          ? req.query.preorder === "true"
          : undefined,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        startAmount: req.query.startAmount
          ? parseFloat(req.query.startAmount as string)
          : undefined,
        endAmount: req.query.endAmount
          ? parseFloat(req.query.endAmount as string)
          : undefined,
        startRate: req.query.startRate
          ? parseFloat(req.query.startRate as string)
          : undefined,
        endRate: req.query.endRate
          ? parseFloat(req.query.endRate as string)
          : undefined,
      };

      const result = await this.giftCardService.getUserTransactions(
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

  getTransaction = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const userId = req.user!.id;
      const includeChildren = req.query.includeChildren === "true";

      const transaction = includeChildren
        ? await this.giftCardService.getTransactionWithChildren(
            reference,
            userId
          )
        : await this.giftCardService.getTransaction(
            reference,
            userId
          );

      return sendSuccessResponse(
        res,
        transaction,
        "Gift card transaction retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getGroupedTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { groupTag } = req.params;
      const userId = req.user!.id;

      const transactions =
        await this.giftCardService.getGroupedTransactions(
          groupTag,
          userId
        );

      return sendSuccessResponse(
        res,
        transactions,
        "Grouped transactions retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  exportTransactions = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;

      const filters = {
        tradeType: req.query.tradeType as "buy" | "sell",
        status: req.query.status as string,
        cardType: req.query.cardType as "physical" | "ecode",
        giftCardType: req.query.giftCardType as string,
        giftCardId: req.query.giftCardId as string,
        groupTag: req.query.groupTag as string,
        preorder: req.query.preorder
          ? req.query.preorder === "true"
          : undefined,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const csvData = await this.giftCardService.exportTransactions(
        userId,
        filters
      );

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=giftcard_transactions_${
          new Date().toISOString().split("T")[0]
        }.csv`
      );

      return res.send(csvData);
    } catch (error) {
      next(error);
    }
  };

  generateReceipt = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const userId = req.user!.id;

      const receipt = await this.giftCardService.generateReceipt(
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
}
