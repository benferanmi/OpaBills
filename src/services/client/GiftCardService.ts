import {
  GiftCardRepository,
  GiftCardCategoryRepository,
  GiftCardTransactionRepository,
} from "@/repositories/GiftCardRepository";
import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletService } from "./WalletService";
import { ReloadlyService } from "./providers/ReloadlyService";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { AppError } from "@/middlewares/errorHandler";
import { generateReference } from "@/utils/helpers";
import { NotificationService } from "./NotificationService";
import { IUser } from "@/models/core/User";
import logger from "@/logger";

export interface GiftCardTransactionFilters {
  tradeType?: "buy" | "sell";
  status?: string;
  cardType?: "physical" | "ecode";
  giftCardType?: string;
  giftCardId?: string;
  reference?: string;
  groupTag?: string;
  preorder?: boolean;
  startDate?: string;
  endDate?: string;
  startAmount?: number;
  endAmount?: number;
  startRate?: number;
  endRate?: number;
}
export class GiftCardService {
  private giftCardRepository: GiftCardRepository;
  private giftCardCategoryRepository: GiftCardCategoryRepository;
  private giftCardTransactionRepository: GiftCardTransactionRepository;
  private bankAccountRepository: BankAccountRepository;
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  private reloadlyService: ReloadlyService;
  private notificationService: NotificationService;

  constructor() {
    this.giftCardRepository = new GiftCardRepository();
    this.giftCardCategoryRepository = new GiftCardCategoryRepository();
    this.giftCardTransactionRepository = new GiftCardTransactionRepository();
    this.bankAccountRepository = new BankAccountRepository();
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.reloadlyService = new ReloadlyService();
    this.notificationService = new NotificationService();
  }

  // CATEGORY METHODS
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

  // GIFTCARD PRODUCTS METHODS
  async getGiftCards(filters: any = {}, page: number = 1, limit: number = 10) {
    const result = await this.giftCardRepository.findAll(filters, page, limit);
    return result;
  }

  async getAvailableDenominations(giftCardId: string) {
    const giftCard = await this.getGiftCardById(giftCardId);

    if (giftCard.denominationType === "FIXED") {
      const priceList =
        giftCard.priceList || giftCard.fixedRecipientDenominations || [];
      const ngnPriceList =
        giftCard.ngnPriceList || giftCard.fixedSenderDenominations || [];

      const denominations = priceList.map((amount: number, index: number) => {
        let ngnAmount: number | null = null;

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

  // BREAKDOWN CALCULATION
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

    this.validateAmount(giftCard, data.amount, data.tradeType);

    let rate: number;
    let metadata: any = {
      denominationType: giftCard.denominationType,
      currency: giftCard.currency,
    };

    if (data.tradeType === "buy") {
      if (giftCard.denominationType === "FIXED") {
        const fixedRate = this.getFixedDenominationRate(giftCard, data.amount);

        if (fixedRate) {
          rate = fixedRate;
          metadata.rateSource = "stored_fixed_denomination";
        } else {
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

    const serviceCharge = data.tradeType === "buy" ? 1000 : 0;

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

  // BUY GIFTCARD (via Reloadly)
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

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "Gift card purchase",
      "main",
      {
        type: "gift_card_purchase",
        provider: "reloadly",
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        meta: {
          giftCardName: giftCard.name,
          quantity: data.quantity,
          productId: giftCard.productId,
        },
      }
    );

    const transaction = debitResult.transaction;

    // Create gift card transaction
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
        transactionId: transaction.id,
        meta: {
          recipientEmail: data.user.email,
          recipientPhone: data.user.phone,
        },
      }
    );

    // Update transaction with gift card transaction link
    await this.transactionRepository.update(transaction.id, {
      transactableType: "GiftCardTransaction",
      transactableId: giftCardTransaction.id,
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
        await this.transactionRepository.update(transaction.id, {
          providerReference: providerResponse.providerReference,
        });
      }

      if (status === "success") {
        await this.notificationService.createNotification({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "Gift Card Purchase",
            amount: totalAmount,
            reference,
            giftCardName: giftCard.name,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "Gift card purchase failed - refund",
          "main",
          {
            type: "refund",
            provider: "reloadly",
            providerReference: providerResponse.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
              giftCardName: giftCard.name,
            },
          }
        );

        await this.notificationService.createNotification({
          type: "transaction_failed",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "Gift Card Purchase",
            amount: totalAmount,
            reference,
            giftCardName: giftCard.name,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      return {
        ...this.sanitizeGiftCardTransaction(transaction),
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
        "main",
        {
          type: "refund",
          provider: "reloadly",
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: {
            originalReference: reference,
            reason: "error",
            giftCardName: giftCard.name,
          },
        }
      );

      await this.notificationService.createNotification({
        type: "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "Gift Card Purchase",
          amount: totalAmount,
          reference,
          giftCardName: giftCard.name,
        },
        sendEmail: true,
        sendSMS: false,
        sendPush: true,
      });

      throw error;
    }
  }

  //  SELL GIFTCARD (Manual - Pending Admin Review)
  async sellGiftCard(data: {
    userId: string;
    giftCardId: string;
    amount: number;
    quantity: number;
    cardType: "physical" | "ecode";
    cards: string[];
    comment?: string;
    bankAccountId: string;
  }) {
    const reference = generateReference("GIFTCARD_SELL_");
    const groupTag = generateReference("GP");

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

    // Validate amount
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

    // Validate bank account
    const bankAccount = await this.bankAccountRepository.findById(
      data.bankAccountId
    );

    if (!bankAccount || bankAccount.userId.toString() !== data.userId) {
      throw new AppError(
        "Invalid bank account",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const rate = giftCard.sellRate || 1;
    const payableAmount = data.amount * rate * data.quantity;

    // Check if user has existing pending transactions for this gift card
    const existingPendingTransactions =
      await this.giftCardTransactionRepository.findPendingSellByUserAndGiftCard(
        data.userId,
        data.giftCardId
      );

    let parentTransaction = null;

    // If there are existing pending transactions, find or create parent
    if (existingPendingTransactions.length > 0) {
      // Check if a parent already exists
      parentTransaction = existingPendingTransactions.find(
        (txn) => txn.status === "multiple" && !txn.parentId
      );

      // If no parent exists, convert the first transaction to parent
      if (!parentTransaction) {
        const firstTransaction = existingPendingTransactions[0];

        await this.giftCardTransactionRepository.update(
          firstTransaction.id.toString(),
          {
            status: "multiple",
            groupTag: firstTransaction.groupTag || generateReference("GP"),
          }
        );

        parentTransaction = await this.giftCardTransactionRepository.findById(
          firstTransaction.id.toString()
        );
      }
    }

    // Create the new sell transaction
    const giftCardTransaction = await this.giftCardTransactionRepository.create(
      {
        giftCardId: new Types.ObjectId(data.giftCardId),
        userId: new Types.ObjectId(data.userId),
        parentId: parentTransaction ? parentTransaction.id : undefined,
        reference,
        tradeType: "sell",
        cardType: data.cardType,
        cards: data.cards,
        comment: data.comment,
        amount: data.amount,
        quantity: data.quantity,
        rate,
        payableAmount,
        originalRate: rate,
        originalAmount: payableAmount,
        status: "pending",
        preorder: false,
        groupTag: parentTransaction?.groupTag || groupTag,
        bankAccountId: new Types.ObjectId(data.bankAccountId),
        bankId: bankAccount.bankId as Types.ObjectId,
        bankCode: bankAccount.bankCode,
        accountName: bankAccount.accountName,
        accountNumber: bankAccount.accountNumber,
        meta: {
          cardImages: data.cards,
        },
      }
    );

    // Send notification using NotificationService
    await this.notificationService.createNotification({
      type: "giftcard_sell_submitted",
      notifiableType: "User",
      notifiableId: new Types.ObjectId(data.userId),
      data: {
        transactionType: "Gift Card Sale",
        amount: payableAmount,
        reference,
        giftCardName: giftCard.name,
        status: "pending_review",
      },
      sendEmail: true,
      sendSMS: false,
      sendPush: true,
    });

    return {
      transaction: giftCardTransaction,
      message: "Gift card submitted for review successfully",
      status: "pending",
      hasMultipleTransactions: !!parentTransaction,
    };
  }

  // GET REDEEM CODE
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

  async getUserTransactions(
    userId: string,
    filters: GiftCardTransactionFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const query: any = { userId };

    // Trade type filter
    if (filters.tradeType) {
      query.tradeType = filters.tradeType;
    }

    // Status filter
    if (filters.status) {
      query.status = filters.status;
    }

    // Card type filter
    if (filters.cardType) {
      query.cardType = filters.cardType;
    }

    // Gift card type filter
    if (filters.giftCardType) {
      query.giftCardType = filters.giftCardType;
    }

    // Gift card ID filter
    if (filters.giftCardId) {
      query.giftCardId = filters.giftCardId;
    }

    // Reference filter (partial match)
    if (filters.reference) {
      query.reference = { $regex: filters.reference, $options: "i" };
    }

    // Group tag filter
    if (filters.groupTag) {
      query.groupTag = filters.groupTag;
    }

    // Preorder filter
    if (filters.preorder !== undefined) {
      query.preorder = filters.preorder;
    }

    // Date range filter
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Set to end of day
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Amount range filter
    if (filters.startAmount !== undefined || filters.endAmount !== undefined) {
      query.amount = {};
      if (filters.startAmount !== undefined) {
        query.amount.$gte = filters.startAmount;
      }
      if (filters.endAmount !== undefined) {
        query.amount.$lte = filters.endAmount;
      }
    }

    // Rate range filter
    if (filters.startRate !== undefined || filters.endRate !== undefined) {
      query.rate = {};
      if (filters.startRate !== undefined) {
        query.rate.$gte = filters.startRate;
      }
      if (filters.endRate !== undefined) {
        query.rate.$lte = filters.endRate;
      }
    }

    return this.giftCardTransactionRepository.findWithFilters(
      query,
      page,
      limit
    );
  }

  async getTransaction(reference: string, userId: string): Promise<any> {
    const transaction =
      await this.giftCardTransactionRepository.findByReferenceWithoutPopulate(
        reference
      );

    if (!transaction) {
      throw new AppError(
        "Gift card transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    console.log(transaction.userId?.toString(), userId);

    if (transaction.userId?.toString() !== userId) {
      throw new AppError(
        "Unauthorized access to gift card transaction",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    return transaction;
  }

  async getTransactionWithChildren(
    reference: string,
    userId: string
  ): Promise<any> {
    const transaction = await this.getTransaction(reference, userId);

    // If status is 'multiple', fetch child transactions
    if (transaction.status === "multiple" && transaction._id) {
      const children =
        await this.giftCardTransactionRepository.findChildTransactions(
          transaction._id
        );
      return {
        ...this.sanitizeGiftCardTransaction(transaction),
        children,
      };
    }

    return transaction;
  }

  async exportTransactions(
    userId: string,
    filters: GiftCardTransactionFilters = {}
  ): Promise<string> {
    const query: any = { userId };

    if (filters.tradeType) query.tradeType = filters.tradeType;
    if (filters.status) query.status = filters.status;
    if (filters.cardType) query.cardType = filters.cardType;
    if (filters.giftCardType) query.giftCardType = filters.giftCardType;
    if (filters.giftCardId) query.giftCardId = filters.giftCardId;
    if (filters.groupTag) query.groupTag = filters.groupTag;
    if (filters.preorder !== undefined) query.preorder = filters.preorder;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const result = await this.giftCardTransactionRepository.findWithFilters(
      query,
      1,
      10000
    );

    // Generate CSV
    const headers = [
      "Reference",
      "Trade Type",
      "Gift Card Type",
      "Card Type",
      "Amount",
      "Quantity",
      "Rate",
      "Payable Amount",
      "Service Charge",
      "Status",
      "Preorder",
      "Bank Account",
      "Group Tag",
      "Review Note",
      "Date",
    ];

    const rows = result.data.map((t: any) => [
      t.reference,
      t.tradeType || "",
      t.giftCardType || "",
      t.cardType || "",
      t.amount,
      t.quantity,
      t.rate || "",
      t.payableAmount || "",
      t.serviceCharge || 0,
      t.status,
      t.preorder ? "Yes" : "No",
      t.accountNumber || "",
      t.groupTag || "",
      t.reviewNote || "",
      new Date(t.createdAt).toISOString(),
    ]);

    // Escape CSV values that contain commas or quotes
    const escapeCsvValue = (value: any): string => {
      const strValue = String(value);
      if (
        strValue.includes(",") ||
        strValue.includes('"') ||
        strValue.includes("\n")
      ) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    };

    const csv = [
      headers.join(","),
      ...rows.map((row: any[]) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    return csv;
  }

  async generateReceipt(reference: string, userId: string): Promise<any> {
    const transaction =
      await this.giftCardTransactionRepository.findByReference(reference);

    if (!transaction) {
      throw new AppError(
        "Gift card transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Verify ownership
    if (transaction.userId?.toString() !== userId) {
      throw new AppError(
        "Unauthorized access to gift card transaction",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    // Only generate receipts for successful or approved transactions
    if (!["success", "approved", "s.approved"].includes(transaction.status)) {
      throw new AppError(
        "Receipt can only be generated for successful or approved transactions",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.BAD_REQUEST
      );
    }

    return {
      receiptNumber: `GC-RCP-${transaction.reference}`,
      reference: transaction.reference,
      providerReference: transaction.providerReference,
      tradeType: transaction.tradeType,
      giftCardType: transaction.giftCardType,
      cardType: transaction.cardType,
      amount: transaction.amount,
      quantity: transaction.quantity,
      rate: transaction.rate,
      payableAmount: transaction.payableAmount,
      serviceCharge: transaction.serviceCharge,
      status: transaction.status,
      bankDetails: transaction.accountNumber
        ? {
            accountName: transaction.accountName,
            accountNumber: transaction.accountNumber,
            bankCode: transaction.bankCode,
          }
        : null,
      reviewNote: transaction.reviewNote,
      meta: transaction.meta,
      transactionDate: transaction.createdAt,
      generatedAt: new Date(),
    };
  }

  async getGroupedTransactions(
    groupTag: string,
    userId: string
  ): Promise<any[]> {
    // First verify user owns at least one transaction in this group
    const query = { groupTag, userId };
    const result = await this.giftCardTransactionRepository.findWithFilters(
      query,
      1,
      1
    );

    if (result.total === 0) {
      throw new AppError(
        "No transactions found in this group",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Fetch all transactions in the group
    return this.giftCardTransactionRepository.findByGroupTag(groupTag);
  }

  private calculateRateFromProduct(product: any): number {
    if (
      product.fixedRecipientToSenderDenominationsMap &&
      typeof product.fixedRecipientToSenderDenominationsMap === "object" &&
      Object.keys(product.fixedRecipientToSenderDenominationsMap).length > 0
    ) {
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

    let rate = product.recipientCurrencyToSenderCurrencyExchangeRate || 1;

    if (product.senderFeePercentage && product.senderFeePercentage > 0) {
      rate = rate * (1 + product.senderFeePercentage / 100);
    }

    if (product.discountPercentage && product.discountPercentage > 0) {
      rate = rate * (1 - product.discountPercentage / 100);
    }

    return rate;
  }

  private validateAmount(
    giftCard: any,
    amount: number,
    tradeType: "buy" | "sell"
  ): void {
    if (tradeType === "sell") {
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

  private getFixedDenominationRate(
    giftCard: any,
    amount: number
  ): number | null {
    if (giftCard.denominationType !== "FIXED") {
      return null;
    }

    const numAmount = Number(amount);

    if (
      giftCard.mappedPriceList &&
      giftCard.mappedPriceList[numAmount.toFixed(1)]
    ) {
      const ngnAmount = giftCard.mappedPriceList[numAmount.toFixed(1)];
      return ngnAmount / amount;
    }

    if (giftCard.fixedRecipientToSenderDenominationsMap) {
      const key = numAmount.toFixed(2);
      if (giftCard.fixedRecipientToSenderDenominationsMap[key]) {
        const ngnAmount = giftCard.fixedRecipientToSenderDenominationsMap[key];
        return ngnAmount / numAmount;
      }
    }

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

  private sanitizeGiftCardTransaction(transaction: any) {
    return {
      id: transaction._id || transaction.id,
      reference: transaction.reference,
      tradeType: transaction.tradeType,

      // Card details
      cardType: transaction.cardType,
      cards: transaction.cards,
      comment: transaction.comment,

      // Amounts
      amount: transaction.amount,
      quantity: transaction.quantity,
      rate: transaction.rate,
      serviceCharge: transaction.serviceCharge,
      payableAmount: transaction.payableAmount,

      // Status & grouping
      status: transaction.status,
      preorder: transaction.preorder,
      groupTag: transaction.groupTag,

      // Provider reference (for buy transactions)
      providerReference: transaction.providerReference,

      // Review info (user-facing only)
      reviewNote: transaction.reviewNote,

      // Bank details (if exists - for sell transactions)
      ...(transaction.accountNumber && {
        bankDetails: {
          accountName: transaction.accountName,
          accountNumber: transaction.accountNumber,
          bankCode: transaction.bankCode,
        },
      }),

      // Timestamps
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
