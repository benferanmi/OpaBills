import {
  GiftCardRepository,
  GiftCardCategoryRepository,
  GiftCardTransactionRepository,
} from "@/repositories/GiftCardRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { ProviderService } from "./ProviderService";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "@/middlewares/errorHandler";
import { generateReference } from "@/utils/helpers";

export class GiftCardService {
  private giftCardRepository: GiftCardRepository;
  private giftCardCategoryRepository: GiftCardCategoryRepository;
  private giftCardTransactionRepository: GiftCardTransactionRepository;
  private transactionRepository: TransactionRepository;
  private bankAccountRepository: BankAccountRepository;
  private walletService: WalletService;
  private providerService: ProviderService;
  private notificationRepository: NotificationRepository;
  constructor() {
    this.giftCardRepository = new GiftCardRepository();
    this.giftCardCategoryRepository = new GiftCardCategoryRepository();
    this.giftCardTransactionRepository = new GiftCardTransactionRepository();
    this.transactionRepository = new TransactionRepository();
    this.bankAccountRepository = new BankAccountRepository();
    this.walletService = new WalletService();
    this.providerService = new ProviderService();
    this.notificationRepository = new NotificationRepository();
  }

  async getCategories(page: number = 1, limit: number = 10) {
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

  async getGiftCards(filters: any = {}, page: number = 1, limit: number = 10) {
    if (filters.categoryId) {
      return this.giftCardRepository.findByCategory(
        filters.categoryId,
        page,
        limit
      );
    }
    if (filters.countryId) {
      return this.giftCardRepository.findByCountry(
        filters.countryId,
        page,
        limit
      );
    }
    if (filters.search) {
      return this.giftCardRepository.searchGiftCards(
        filters.search,
        page,
        limit
      );
    }
    return this.giftCardRepository.findWithPagination(
      { status: "active" },
      page,
      limit
    );
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

  async buyGiftCard(data: {
    userId: string;
    giftCardId: string;
    amount: number;
    quantity: number;
  }) {
    const reference = generateReference();

    // Get gift card
    const giftCard = await this.getGiftCardById(data.giftCardId);

    // Validate amount limits
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

    // Get user wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Calculate total
    const serviceCharge = 0; // Can be configured
    const rate = giftCard.buyRate || 1;
    const totalAmount = data.amount * rate * data.quantity + serviceCharge;

    // Check balance
    if (wallet.balance < totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct from wallet
    await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "Gift card purchase",
      "main"
    );

    // Create gift card transaction
    const giftCardTransaction = await this.giftCardTransactionRepository.create(
      {
        _id: uuidv4(),
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
      }
    );

    // Create main transaction
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "GiftCardTransaction",
      transactableId: new Types.ObjectId(giftCardTransaction._id),
      reference,
      amount: totalAmount,
      type: "gift_card_purchase",
      provider: "internal",
      remark: `Gift card purchase: ${giftCard.name}`,
      purpose: "gift_card_purchase",
      status: "pending",
      meta: { giftCardName: giftCard.name, quantity: data.quantity },
    });

    // Update gift card transaction with transaction ID
    await this.giftCardTransactionRepository.update(giftCardTransaction._id, {
      transactionId: transaction._id,
    });

    // Call provider API
    try {
      const providerResponse = {
        success: true,
      }
      // await this.providerService.purchaseGiftCard({
      //   giftCardId: data.giftCardId,
      //   amount: data.amount,
      //   quantity: data.quantity,
      // });

      // Update statuses
      const status = providerResponse.success ? "success" : "failed";
      await this.giftCardTransactionRepository.updateStatus(
        giftCardTransaction._id,
        status
      );
      await this.transactionRepository.updateStatus(transaction.id, status);

      // Send notification
      await this.notificationRepository.create({
        type:
          status === "success" ? "transaction_success" : "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "Gift Card Purchase",
          amount: totalAmount,
          reference,
          giftCardName: giftCard.name,
        },
      });

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "Gift card purchase failed - refund",
          "main"
        );
      }

      return {
        ...giftCardTransaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.giftCardTransactionRepository.updateStatus(
        giftCardTransaction._id,
        "failed"
      );
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "Gift card purchase error - refund",
        "main"
      );

      // Send failure notification
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

      throw error;
    }
  }

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
    const reference = generateReference();

    // Get gift card
    const giftCard = await this.getGiftCardById(data.giftCardId);

    // Get category and check if sale is activated
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

    // Validate amount limits
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

    // Get bank account
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

    // Calculate payable amount
    const rate = giftCard.sellRate || 1;
    const payableAmount = data.amount * rate * data.quantity;

    // Create gift card transaction (pending approval)
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
        bankCode: bankAccount.bankCode,
        accountName: bankAccount.accountName,
        accountNumber: bankAccount.accountNumber,
      }
    );

    return giftCardTransaction;
  }

  async bulkBuyGiftCards(data: {
    userId: string;
    items: Array<{ giftCardId: string; amount: number; quantity: number }>;
  }) {
    const groupTag = uuidv4();
    const transactions: any[] = [];
    let totalAmount = 0;

    // Validate all items and calculate total
    for (const item of data.items) {
      const giftCard = await this.getGiftCardById(item.giftCardId);

      // Validate amount limits
      if (giftCard.buyMinAmount && item.amount < giftCard.buyMinAmount) {
        throw new AppError(
          `Minimum purchase amount for ${giftCard.name} is ${giftCard.buyMinAmount}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
      if (giftCard.buyMaxAmount && item.amount > giftCard.buyMaxAmount) {
        throw new AppError(
          `Maximum purchase amount for ${giftCard.name} is ${giftCard.buyMaxAmount}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const serviceCharge = 0;
      const rate = giftCard.buyRate || 1;
      const itemTotal = item.amount * rate * item.quantity + serviceCharge;
      totalAmount += itemTotal;

      transactions.push({ giftCard, item, serviceCharge, rate, itemTotal });
    }

    // Check wallet balance
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (wallet.balance < totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct total amount
    await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "Bulk gift card purchase",
      "main"
    );

    // Create transactions
    const results: any[] = [];
    for (const txn of transactions) {
      const reference = generateReference();

      const giftCardTransaction =
        await this.giftCardTransactionRepository.create({
          _id: uuidv4(),
          giftCardId: txn.giftCard._id,
          userId: new Types.ObjectId(data.userId),
          reference,
          tradeType: "buy",
          amount: txn.item.amount,
          quantity: txn.item.quantity,
          serviceCharge: txn.serviceCharge,
          rate: txn.rate,
          payableAmount: txn.itemTotal,
          groupTag,
          status: "pending",
          preorder: false,
        });

      results.push(giftCardTransaction);
    }

    return { groupTag, transactions: results, totalAmount };
  }

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
      query.saleActivated = true;
    } else {
      query.purchaseActivated = true;
    }

    return this.giftCardRepository.findWithPagination(query, page, limit);
  }

  async calculateBreakdown(data: {
    giftCardId: string;
    amount: number;
    quantity: number;
    tradeType: "buy" | "sell";
  }) {
    const giftCard = await this.getGiftCardById(data.giftCardId);

    const rate =
      data.tradeType === "buy" ? giftCard.buyRate : giftCard.sellRate;
    const serviceCharge = 0; // Can be configured

    let payableAmount: number;
    if (data.tradeType === "buy") {
      payableAmount = data.amount * (rate || 1) * data.quantity + serviceCharge;
    } else {
      payableAmount = data.amount * (rate || 1) * data.quantity;
    }

    return {
      giftCard: {
        id: giftCard._id,
        name: giftCard.name,
        logo: giftCard.logo,
      },
      amount: data.amount,
      quantity: data.quantity,
      rate,
      serviceCharge,
      payableAmount,
      tradeType: data.tradeType,
    };
  }

  async getGiftCardRates() {
    const giftCards = await this.giftCardRepository.findWithPagination(
      { status: "active" },
      1,
      100
    );

    return giftCards.data.map((gc: any) => ({
      id: gc._id,
      name: gc.name,
      logo: gc.logo,
      buyRate: gc.buyRate,
      sellRate: gc.sellRate,
      saleActivated: gc.saleActivated,
      purchaseActivated: gc.purchaseActivated,
    }));
  }
}
