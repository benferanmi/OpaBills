import {
  GiftCardRepository,
  GiftCardCategoryRepository,
  GiftCardTransactionRepository,
} from "@/repositories/GiftCardRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { ReloadlyService } from "./providers/ReloadlyService";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/middlewares/errorHandler";
import { generateReference } from "@/utils/helpers";
import { IUser } from "@/models/core/User";
import logger from "@/logger";

export class GiftCardService {
  private giftCardRepository: GiftCardRepository;
  private giftCardCategoryRepository: GiftCardCategoryRepository;
  private giftCardTransactionRepository: GiftCardTransactionRepository;
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  private reloadlyService: ReloadlyService;
  private notificationRepository: NotificationRepository;

  constructor() {
    this.giftCardRepository = new GiftCardRepository();
    this.giftCardCategoryRepository = new GiftCardCategoryRepository();
    this.giftCardTransactionRepository = new GiftCardTransactionRepository();
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.reloadlyService = new ReloadlyService();
    this.notificationRepository = new NotificationRepository();
  }

  /**
   * CATEGORY METHODS
   */
  async getCategories(
    page: number = 1,
    limit: number = 10,
    type: "both" | "sell" | "buy" = "both"
  ) {
    return this.giftCardCategoryRepository.findActive(page, limit);
  }

  async getCategoryById(categoryId: string) {
    const category = await this.giftCardCategoryRepository.findByCategoryId(
      categoryId
    );
    if (!category) {
      throw new AppError(
        "Category not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return category;
  }

  /**
   * GIFTCARD PRODUCTS METHODS
   */
  async getGiftCards(filters: any = {}, page: number = 1, limit: number = 10) {
    // if (filters.categoryId) {
    //   return this.giftCardRepository.findByCategory(
    //     filters.categoryId,
    //     page,
    //     limit
    //   );
    // }
    // if (filters.countryId) {
    //   return this.giftCardRepository.findByCountry(
    //     filters.countryId,
    //     page,
    //     limit
    //   );
    // }
    // if (filters.search) {
    //   return this.giftCardRepository.searchGiftCards(
    //     filters.search,
    //     page,
    //     limit
    //   );
    // }
    // return this.giftCardRepository.findWithPagination(
    //   { status: "active" },
    //   page,
    //   limit
    // );

    //TODO: population of category and country
    const result = await this.giftCardRepository.findAll(filters, page, limit);
    return result;
  }

  /**
   * Gets available denominations for a gift card
   */
  async getAvailableDenominations(giftCardId: string) {
    const giftCard = await this.getGiftCardById(giftCardId);

    console.log(giftCard);

    if (giftCard.denominationType === "FIXED") {
      const priceList =
        giftCard.priceList || giftCard.fixedRecipientDenominations || [];
      const ngnPriceList =
        giftCard.ngnPriceList || giftCard.fixedSenderDenominations || [];

      const denominations = priceList.map((amount: number, index: number) => {
        let ngnAmount: number | null = null;

        // Try to get NGN amount from various sources
        if (ngnPriceList[index]) {
          ngnAmount = ngnPriceList[index];
        } else if (
          giftCard.mappedPriceList &&
          giftCard.mappedPriceList[amount.toFixed(1)]
        ) {
          ngnAmount = giftCard.mappedPriceList[amount.toFixed(1)];
        } else if (giftCard.fixedRecipientToSenderDenominationsMap) {
          const key = amount.toFixed(2);
          ngnAmount =
            giftCard.fixedRecipientToSenderDenominationsMap[key] || null;
        }

        return {
          amount,
          currency: giftCard.currency,
          ngnAmount,
          display: `${giftCard.currency} ${amount}${
            ngnAmount ? ` (₦${ngnAmount.toLocaleString()})` : ""
          }`,
        };
      });

      return {
        type: "FIXED" as const,
        currency: giftCard.currency,
        denominations,
      };
    } else {
      // Return range information
      return {
        type: "RANGE" as const,
        currency: giftCard.currency,
        minAmount: giftCard.buyMinAmount,
        maxAmount: giftCard.buyMaxAmount,
        minAmountNgn: giftCard.minAmountNgn,
        maxAmountNgn: giftCard.maxAmountNgn,
        rate: giftCard.buyRate || giftCard.exchangeRate,
        display: `${giftCard.currency} ${giftCard.buyMinAmount} - ${giftCard.buyMaxAmount}`,
      };
    }
  }

  async getGiftCardById(giftCardId: string) {
    const giftCard = await this.giftCardRepository.findById(giftCardId);

    if (!giftCard || giftCard.status !== "active") {
      throw new AppError(
        "Gift card not found or inactive",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return giftCard;
  }

  async getGiftCardsByType(type: string, page: number = 1, limit: number = 20) {
    if (type !== "sell" && type !== "buy") {
      throw new AppError(
        'Invalid type. Must be "sell" or "buy"',
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const query: any = { status: "active" };

    if (type === "sell") {
      query.sellRate = { $exists: true, $ne: null };
    } else {
      query.buyRate = { $exists: true, $ne: null };
    }

    return this.giftCardRepository.findWithPagination(query, page, limit);
  }

  async getGiftCardRates() {
    console.log("called");
    const giftCards = await this.giftCardRepository.findWithPagination(
      { status: "active" },
      1,
      100
    );

    return giftCards.data.map((gc: any) => ({
      id: gc._id,
      productId: gc.productId,
      name: gc.name,
      logo: gc.logo,
      buyRate: gc.buyRate,
      sellRate: gc.sellRate,
      buyMinAmount: gc.buyMinAmount,
      buyMaxAmount: gc.buyMaxAmount,
      sellMinAmount: gc.sellMinAmount,
      sellMaxAmount: gc.sellMaxAmount,
    }));
  }

  /**
   * BREAKDOWN CALCULATION
   */
  async calculateBreakdown(data: {
    giftCardId: string;
    amount: number;
    quantity: number;
    tradeType: "buy" | "sell";
  }) {
    const giftCard = await this.getGiftCardById(data.giftCardId);

    const category = await this.giftCardCategoryRepository.findById(
      giftCard.categoryId.toString()
    );

    if (!category) {
      throw new AppError(
        "Gift card category not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Check if trade type is activated
    if (data.tradeType === "buy" && !category.purchaseActivated) {
      throw new AppError(
        "Purchase not activated for this gift card",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (data.tradeType === "sell" && !category.saleActivated) {
      throw new AppError(
        "Sale not activated for this gift card",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate amount based on denomination type
    this.validateAmount(giftCard, data.amount, data.tradeType);

    let rate: number;
    let metadata: any = {
      denominationType: giftCard.denominationType,
      currency: giftCard.currency,
    };

    if (data.tradeType === "buy") {
      // For FIXED denominations, try to get exact rate from stored mapping
      if (giftCard.denominationType === "FIXED") {
        const fixedRate = this.getFixedDenominationRate(giftCard, data.amount);

        if (fixedRate) {
          rate = fixedRate;
          metadata.rateSource = "stored_fixed_denomination";
        } else {
          // Fetch real-time rate if stored rate not found
          try {
            const productDetails =
              await this.reloadlyService.getGiftCardProductById(
                Number(giftCard.productId)
              );
            rate = this.calculateRateFromProduct(productDetails);
            metadata.rateSource = "reloadly_api_fixed";
          } catch (error) {
            logger.warn(
              "Failed to fetch real-time rate for fixed denomination",
              error
            );
            rate = giftCard.buyRate || giftCard.exchangeRate || 1;
            metadata.rateSource = "fallback_stored_rate";
          }
        }
      } else {
        // For RANGE denominations, fetch real-time rate
        try {
          const productDetails =
            await this.reloadlyService.getGiftCardProductById(
              Number(giftCard.productId)
            );
          rate = this.calculateRateFromProduct(productDetails);
          metadata.rateSource = "reloadly_api_range";
        } catch (error) {
          logger.warn(
            "Failed to fetch real-time rate, using stored rate",
            error
          );
          rate = giftCard.buyRate || giftCard.exchangeRate || 1;
          metadata.rateSource = "fallback_stored_rate";
        }
      }
    } else {
      // Sell rate
      if (!giftCard.sellRate) {
        throw new AppError(
          "Sell rate not available for this gift card",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      rate = giftCard.sellRate;
      metadata.rateSource = "stored_sell_rate";
    }

    // Calculate service charge (can be fetched from settings)
    const serviceCharge = 1000; //TODO: get from admin or env

    // Calculate payable amount
    let payableAmount: number;
    if (data.tradeType === "buy") {
      const subtotal = data.amount * rate * data.quantity;
      payableAmount = subtotal + serviceCharge;

      metadata.subtotal = subtotal;
      metadata.breakdown = {
        unitPrice: data.amount,
        ratePerUnit: rate,
        quantity: data.quantity,
        subtotal: subtotal,
        serviceCharge: serviceCharge,
        total: payableAmount,
      };
    } else {
      payableAmount = data.amount * rate * data.quantity;

      metadata.breakdown = {
        unitPrice: data.amount,
        ratePerUnit: rate,
        quantity: data.quantity,
        total: payableAmount,
      };
    }

    return {
      giftCard: {
        id: giftCard._id,
        productId: giftCard.productId,
        name: giftCard.name,
        logo: giftCard.logo,
        currency: giftCard.currency,
        denominationType: giftCard.denominationType,
      },
      amount: data.amount,
      quantity: data.quantity,
      rate,
      serviceCharge,
      payableAmount,
      tradeType: data.tradeType,
      metadata,
    };
  }

  /**
   * BUY GIFTCARD
   */
  async buyGiftCard(data: {
    userId: string;
    user: IUser;
    giftCardId: string;
    amount: number;
    quantity: number;
  }) {
    const reference = generateReference("GIFTCARD_BUY_");

    const giftCard = await this.getGiftCardById(data.giftCardId);

    const category = await this.giftCardCategoryRepository.findById(
      giftCard.categoryId.toString()
    );
    if (!category || !category.purchaseActivated) {
      throw new AppError(
        "Gift card purchase not activated",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (giftCard.buyMinAmount && data.amount < giftCard.buyMinAmount) {
      throw new AppError(
        `Minimum purchase amount is ${giftCard.buyMinAmount}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    if (giftCard.buyMaxAmount && data.amount > giftCard.buyMaxAmount) {
      throw new AppError(
        `Maximum purchase amount is ${giftCard.buyMaxAmount}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    const serviceCharge = 0;
    const rate = giftCard.buyRate || 1;
    const totalAmount = data.amount * rate * data.quantity + serviceCharge;

    if (wallet.balance < totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "Gift card purchase",
      "main"
    );

    const giftCardTransaction = await this.giftCardTransactionRepository.create(
      {
        giftCardId: giftCard.id,
        userId: new Types.ObjectId(data.userId),
        reference,
        tradeType: "buy",
        amount: data.amount,
        quantity: data.quantity,
        serviceCharge,
        rate,
        payableAmount: totalAmount,
        status: "pending",
        preorder: false,
        meta: {
          recipientEmail: data.user.email,
          recipientPhone: data.user.phone,
        },
      }
    );

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "GiftCardTransaction",
      transactableId: giftCardTransaction.id,
      reference,
      amount: totalAmount,
      type: "gift_card_purchase",
      direction: "DEBIT",
      provider: "reloadly",
      remark: `Gift card purchase: ${giftCard.name}`,
      purpose: "gift_card_purchase",
      status: "pending",
      meta: {
        giftCardName: giftCard.name,
        quantity: data.quantity,
        productId: giftCard.productId,
      },
    });

    await this.giftCardTransactionRepository.update(giftCardTransaction.id, {
      transactionId: transaction.id,
    });

    try {
      const providerResponse = await this.reloadlyService.orderGiftCard({
        productId: parseInt(giftCard.productId),
        quantity: data.quantity,
        unitPrice: data.amount,
        customIdentifier: reference,
        senderName: data.user.firstname || "Customer",
        recipientEmail: data.user.email,
        recipientPhoneDetails: {
          //TODO: get the country code using the user country
          countryCode: "NG",
          phoneNumber: data.user.phone,
        },
      });

      let status: "success" | "pending" | "failed";

      if (providerResponse.success) {
        status = "success";
      } else if (providerResponse.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      await this.giftCardTransactionRepository.updateStatus(
        giftCardTransaction.id,
        status
      );
      await this.transactionRepository.updateStatus(transaction.id, status);

      if (providerResponse.providerReference) {
        await this.giftCardTransactionRepository.update(
          giftCardTransaction.id,
          {
            providerReference: providerResponse.providerReference,
          }
        );
      }

      if (this.notificationRepository && status === "success") {
        await this.notificationRepository.create({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "Gift Card Purchase",
            amount: totalAmount,
            reference,
            giftCardName: giftCard.name,
          },
        });
      }

      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "Gift card purchase failed - refund",
          "main"
        );

        if (this.notificationRepository) {
          await this.notificationRepository.create({
            type: "transaction_failed",
            notifiableType: "User",
            notifiableId: new Types.ObjectId(data.userId),
            data: {
              transactionType: "Gift Card Purchase",
              amount: totalAmount,
              reference,
              giftCardName: giftCard.name,
            },
          });
        }
      }

      return {
        ...transaction.toObject(),
        status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.giftCardTransactionRepository.updateStatus(
        giftCardTransaction.id,
        "failed"
      );
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "Gift card purchase error - refund",
        "main"
      );

      if (this.notificationRepository) {
        await this.notificationRepository.create({
          type: "transaction_failed",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "Gift Card Purchase",
            amount: totalAmount,
            reference,
            giftCardName: giftCard.name,
          },
        });
      }

      throw error;
    }
  }

  /**
   * SELL GIFTCARD
   */
  async sellGiftCard(data: {
    userId: string;
    giftCardId: string;
    amount: number;
    quantity: number;
    cardType: string;
    card: string;
    pin?: string;
    comment?: string;
    bankAccountId: string;
  }) {
    const reference = generateReference("GIFTCARD_SELL_");

    const giftCard = await this.getGiftCardById(data.giftCardId);

    const category = await this.giftCardCategoryRepository.findById(
      giftCard.categoryId.toString()
    );
    if (!category || !category.saleActivated) {
      throw new AppError(
        "Gift card sale not activated for this category",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (giftCard.sellMinAmount && data.amount < giftCard.sellMinAmount) {
      throw new AppError(
        `Minimum sell amount is ${giftCard.sellMinAmount}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    if (giftCard.sellMaxAmount && data.amount > giftCard.sellMaxAmount) {
      throw new AppError(
        `Maximum sell amount is ${giftCard.sellMaxAmount}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const rate = giftCard.sellRate || 1;
    const payableAmount = data.amount * rate * data.quantity;

    const giftCardTransaction = await this.giftCardTransactionRepository.create(
      {
        _id: uuidv4(),
        giftCardId: giftCard.id,
        userId: new Types.ObjectId(data.userId),
        reference,
        tradeType: "sell",
        cardType: data.cardType,
        card: data.card,
        pin: data.pin,
        comment: data.comment,
        amount: data.amount,
        quantity: data.quantity,
        rate,
        payableAmount,
        status: "pending",
        preorder: false,
      }
    );

    return giftCardTransaction;
  }

  /**
   * GET REDEEM CODE
   */
  async getRedeemCode(transactionId: string, userId: string) {
    const transaction = await this.giftCardTransactionRepository.findById(
      transactionId
    );

    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (transaction.userId.toString() !== userId) {
      throw new AppError(
        "Unauthorized",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    if (transaction.status !== "success") {
      throw new AppError(
        "Transaction not completed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const providerReference = transaction.providerReference;
    if (!providerReference) {
      throw new AppError(
        "Provider reference not found",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const redeemCode = await this.reloadlyService.getGiftCardRedeemCode(
      providerReference
    );

    return redeemCode;
  }

  /**
   * TRANSACTION HISTORY
   */
  async getGiftCardTransactions(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {};

    if (filters.tradeType) {
      query.tradeType = filters.tradeType;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    return this.giftCardTransactionRepository.findByUserId(
      userId,
      query,
      page,
      limit
    );
  }

  async getGiftCardTransactionById(transactionId: string) {
    const transaction = await this.giftCardTransactionRepository.findById(
      transactionId
    );
    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return transaction;
  }

  async getGiftCardTransactionByReference(reference: string) {
    const transaction =
      await this.giftCardTransactionRepository.findByReference(reference);
    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return transaction;
  }

  private calculateRateFromProduct(product: any): number {
    // Use fixed denominations map (most accurate)
    if (
      product.fixedRecipientToSenderDenominationsMap &&
      typeof product.fixedRecipientToSenderDenominationsMap === "object" &&
      Object.keys(product.fixedRecipientToSenderDenominationsMap).length > 0
    ) {
      // Get the first denomination mapping
      const firstKey = Object.keys(
        product.fixedRecipientToSenderDenominationsMap
      )[0];
      const recipientAmount = parseFloat(firstKey);
      const senderAmount =
        product.fixedRecipientToSenderDenominationsMap[firstKey];

      if (recipientAmount > 0 && senderAmount > 0) {
        return senderAmount / recipientAmount;
      }
    }

    // Fallback: Use exchange rate with fees
    let rate = product.recipientCurrencyToSenderCurrencyExchangeRate || 1;

    // Apply sender fee percentage if present
    if (product.senderFeePercentage && product.senderFeePercentage > 0) {
      rate = rate * (1 + product.senderFeePercentage / 100);
    }

    // Apply discount percentage if present
    if (product.discountPercentage && product.discountPercentage > 0) {
      rate = rate * (1 - product.discountPercentage / 100);
    }

    return rate;
  }

  /**
   * Validates amount based on denomination type
   */
  private validateAmount(
    giftCard: any,
    amount: number,
    tradeType: "buy" | "sell"
  ): void {
    if (tradeType === "sell") {
      // Sell validation
      if (giftCard.sellMinAmount && amount < giftCard.sellMinAmount) {
        throw new AppError(
          `Minimum sell amount is ${giftCard.sellMinAmount}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      if (giftCard.sellMaxAmount && amount > giftCard.sellMaxAmount) {
        throw new AppError(
          `Maximum sell amount is ${giftCard.sellMaxAmount}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      return;
    }

    // Buy validation
    if (giftCard.denominationType === "FIXED") {
      const priceList =
        giftCard.priceList || giftCard.fixedRecipientDenominations || [];

      if (priceList.length === 0) {
        throw new AppError(
          "No valid denominations available for this gift card",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      if (!priceList.includes(amount)) {
        throw new AppError(
          `Invalid amount. Please choose from available denominations: ${priceList.join(
            ", "
          )}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    } else {
      // For RANGE type, validate min/max
      if (giftCard.buyMinAmount && amount < giftCard.buyMinAmount) {
        throw new AppError(
          `Minimum purchase amount is ${giftCard.buyMinAmount} ${giftCard.currency}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      if (giftCard.buyMaxAmount && amount > giftCard.buyMaxAmount) {
        throw new AppError(
          `Maximum purchase amount is ${giftCard.buyMaxAmount} ${giftCard.currency}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }
  }

  /**
   * Gets exact rate for fixed denomination
   */
  private getFixedDenominationRate(
    giftCard: any,
    amount: number
  ): number | null {
    if (giftCard.denominationType !== "FIXED") {
      return null;
    }

    const numAmount = Number(amount);

    // Try mappedPriceList first
    if (
      giftCard.mappedPriceList &&
      giftCard.mappedPriceList[numAmount.toFixed(1)]
    ) {
      const ngnAmount = giftCard.mappedPriceList[numAmount.toFixed(1)];
      return ngnAmount / amount;
    }

    // Try fixedRecipientToSenderDenominationsMap
    if (giftCard.fixedRecipientToSenderDenominationsMap) {
      const key = numAmount.toFixed(2);
      if (giftCard.fixedRecipientToSenderDenominationsMap[key]) {
        const ngnAmount = giftCard.fixedRecipientToSenderDenominationsMap[key];
        return ngnAmount / numAmount;
      }
    }

    // Try matching indexes in parallel arrays
    const recipientDenoms =
      giftCard.priceList || giftCard.fixedRecipientDenominations || [];
    const senderDenoms =
      giftCard.ngnPriceList || giftCard.fixedSenderDenominations || [];

    const index = recipientDenoms.indexOf(amount);
    if (index !== -1 && senderDenoms[index]) {
      return senderDenoms[index] / numAmount;
    }

    return null;
  }
}
