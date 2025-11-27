import { WalletRepository } from "@/repositories/WalletRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { UserRepository } from "@/repositories/UserRepository";
import { NotificationService } from "./NotificationService";
import { AppError } from "@/middlewares/errorHandler";
import {
  HTTP_STATUS,
  ERROR_CODES,
  CACHE_KEYS,
  WALLET_TYPES,
} from "@/utils/constants";
import { Types } from "mongoose";
import { generateReference } from "@/utils/helpers";
import { CacheService } from "../CacheService";
import logger from "@/logger";
import { Transaction } from "@/models/wallet/Transaction";
import mongoose from "mongoose";
import { Wallet } from "@/models/wallet/Wallet";

export class WalletService {
  private walletRepository: WalletRepository;
  private cacheService: CacheService;
  private transactionRepository: TransactionRepository;
  private userRepository: UserRepository;
  private notificationService: NotificationService;

  constructor() {
    this.walletRepository = new WalletRepository();
    this.cacheService = new CacheService();
    this.transactionRepository = new TransactionRepository();
    this.userRepository = new UserRepository();
    this.notificationService = new NotificationService();
  }

  async getWallet(
    userId: string,
    type: "main" | "bonus" | "commission" = "main"
  ): Promise<any> {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    return {
      id: wallet._id,
      userId: wallet.userId,
      type: wallet.type,
      balance: wallet.balance,
      createdAt: wallet.createdAt,
    };
  }

  async getAllWallets(userId: string): Promise<any> {
    const wallets = await this.walletRepository.findAllByUserId(userId);
    return wallets.map((wallet) => ({
      id: wallet._id,
      type: wallet.type,
      balance: wallet.balance,
    }));
  }

  async creditWallet(
    userId: string | Types.ObjectId,
    amount: number,
    reason: string,
    walletType: "main" | "bonus" | "commission" = "main",
    options?: {
      type?: string;
      provider?: string;
      providerReference?: string;
      transactableType?: string;
      transactableId?: Types.ObjectId;
      idempotencyKey?: string;
      initiatedBy?: Types.ObjectId;
      initiatedByType?: "user" | "system" | "admin";
      meta?: any;
    }
  ): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check for duplicate transaction (idempotency)
      if (options?.idempotencyKey) {
        const existingTransaction = await Transaction.findOne({
          idempotencyKey: options.idempotencyKey,
        });
        if (existingTransaction) {
          logger.warn(`Duplicate credit attempt: ${options.idempotencyKey}`);
          await session.abortTransaction();
          return existingTransaction;
        }
      }

      // Get wallet BEFORE any changes
      const wallet = await this.walletRepository.findByUserId(userId);
      if (!wallet) {
        throw new AppError(
          "Wallet not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Capture balance BEFORE credit
      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + Number(amount);

      // Update wallet balance atomically
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: amount } },
        { session }
      );

      // Generate reference
      const reference = generateReference("TXN");

      // Create transaction record
      const [transaction] = await Transaction.create(
        [
          {
            walletId: wallet._id,
            sourceId:
              options?.transactableType === "User"
                ? options.transactableId
                : userId,
            recipientId: new Types.ObjectId(userId),
            transactableType: options?.transactableType,
            transactableId: options?.transactableId,
            reference,
            providerReference: options?.providerReference,
            amount: Number(amount),
            direction: "CREDIT",
            type: options?.type || "wallet_credit",
            provider: options?.provider || "internal",
            remark: reason,
            purpose: reason,
            status: "success",
            balanceBefore,
            balanceAfter,
            idempotencyKey: options?.idempotencyKey,
            initiatedBy: options?.initiatedBy,
            initiatedByType: options?.initiatedByType || "system",
            meta: options?.meta,
          },
        ],
        { session }
      );

      // Commit all changes atomically
      await session.commitTransaction();

      // Invalidate cache (outside session)
      await this.cacheService.delete(CACHE_KEYS.USER_WALLET(userId.toString()));

      // Send notification (outside session)
      await this.notificationService.createNotification({
        type: "wallet_credit",
        notifiableType: "User",
        notifiableId: userId as Types.ObjectId,
        data: {
          amount,
          balance: balanceAfter,
          reason,
          reference,
        },
        sendEmail: true,
        sendSMS: false,
        sendPush: true,
      });

      logger.info(
        `Wallet credited: ${reference} - User: ${userId}, Amount: ${amount}`
      );

      return {
        walletId: wallet._id,
        reference,
        balanceBefore,
        balanceAfter,
        amount,
        direction: "CREDIT",
        transaction,
      };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error("Credit wallet failed:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async debitWallet(
    userId: string | Types.ObjectId,
    amount: number,
    reason: string,
    walletType: "main" | "bonus" | "commission" = "main",
    options?: {
      type?: string;
      provider?: string;
      providerReference?: string;
      transactableType?: string;
      transactableId?: Types.ObjectId;
      idempotencyKey?: string;
      initiatedBy?: Types.ObjectId;
      initiatedByType?: "user" | "system" | "admin";
      meta?: any;
    }
  ): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check for duplicate transaction (idempotency)
      if (options?.idempotencyKey) {
        const existingTransaction = await Transaction.findOne({
          idempotencyKey: options.idempotencyKey,
        });
        if (existingTransaction) {
          logger.warn(`Duplicate debit attempt: ${options.idempotencyKey}`);
          await session.abortTransaction();
          return existingTransaction;
        }
      }

      // Get wallet BEFORE any changes
      const wallet = await this.walletRepository.findByUserId(userId);
      if (!wallet) {
        throw new AppError(
          "Wallet not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Capture balance BEFORE debit
      const balanceBefore = wallet.balance;

      // Check sufficient balance
      if (balanceBefore < amount) {
        throw new AppError(
          "Insufficient balance",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INSUFFICIENT_BALANCE
        );
      }

      const balanceAfter = balanceBefore - Number(amount);

      // Update wallet balance atomically
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: -amount } },
        { session }
      );

      // Generate reference
      const reference = generateReference("TXN");

      // Create transaction record
      const [transaction] = await Transaction.create(
        [
          {
            walletId: wallet._id,
            sourceId: new Types.ObjectId(userId),
            recipientId:
              options?.transactableType === "User"
                ? options.transactableId
                : undefined,
            transactableType: options?.transactableType,
            transactableId: options?.transactableId,
            reference,
            providerReference: options?.providerReference,
            amount: Number(amount),
            direction: "DEBIT",
            type: options?.type || "wallet_debit",
            provider: options?.provider || "internal",
            remark: reason,
            purpose: reason,
            status: "success",
            balanceBefore,
            balanceAfter,
            idempotencyKey: options?.idempotencyKey,
            initiatedBy: options?.initiatedBy,
            initiatedByType: options?.initiatedByType || "system",
            meta: options?.meta,
          },
        ],
        { session }
      );

      // Commit all changes atomically
      await session.commitTransaction();

      // Invalidate cache (outside session)
      await this.cacheService.delete(CACHE_KEYS.USER_WALLET(userId.toString()));

      // Send notification (outside session)
      await this.notificationService.createNotification({
        type: "wallet_debit",
        notifiableType: "User",
        notifiableId: userId as Types.ObjectId,
        data: {
          amount,
          balance: balanceAfter,
          reason,
          reference,
        },
        sendEmail: true,
        sendSMS: false,
        sendPush: true,
      });

      logger.info(
        `Wallet debited: ${reference} - User: ${userId}, Amount: ${amount}`
      );

      return {
        walletId: wallet._id,
        reference,
        balanceBefore,
        balanceAfter,
        amount,
        direction: "DEBIT",
        transaction,
      };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error("Debit wallet failed:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async getWalletTransactions(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const query: any = { sourceId: userId };

    if (filters.type) {
      query.type = filters.type;
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

    return this.transactionRepository.findWithFilters(query, page, limit);
  }

  async getBalanceHistory(
    userId: string,
    walletType: "main" | "bonus" | "commission" = "main",
    days: number = 30
  ): Promise<any> {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.transactionRepository.findWithFilters(
      {
        walletId: wallet._id,
        createdAt: { $gte: startDate },
      },
      1,
      1000
    );

    return {
      currentBalance: wallet.balance,
      history: transactions.data.map((txn: any) => ({
        date: txn.createdAt,
        balance: txn.balanceAfter,
        amount: txn.amount,
        direction: txn.direction,
        type: txn.type,
        reference: txn.reference,
        status: txn.status,
      })),
    };
  }

  async transferFunds(
    senderId: string,
    recipientIdentifier: string,
    amount: number,
    remark?: string
  ): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find recipient by username, email, or refCode
      let recipient = await this.userRepository.findByUsername(
        recipientIdentifier
      );
      if (!recipient) {
        recipient = await this.userRepository.findByEmail(recipientIdentifier);
      }
      if (!recipient) {
        recipient = await this.userRepository.findByRefCode(
          recipientIdentifier
        );
      }

      if (!recipient) {
        throw new AppError(
          "Recipient not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      if (recipient.id.toString() === senderId) {
        throw new AppError(
          "Cannot transfer to yourself",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Generate transfer ID and references
      const transferId = generateReference("TRF");
      const senderReference = generateReference("TXN");
      const recipientReference = generateReference("TXN");

      // Check for duplicate transfer (idempotency)
      const existingTransfer = await Transaction.findOne({
        idempotencyKey: transferId,
      });
      if (existingTransfer) {
        logger.warn(`Duplicate transfer attempt: ${transferId}`);
        await session.abortTransaction();
        return existingTransfer;
      }

      // Get wallets BEFORE any changes (need balances)
      const senderWallet = await this.walletRepository.findByUserId(senderId);
      const recipientWallet = await this.walletRepository.findByUserId(
        recipient.id
      );

      if (!senderWallet || !recipientWallet) {
        throw new AppError(
          "Wallet not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      // Capture balances BEFORE transfer
      const senderBalanceBefore = senderWallet.balance;
      const recipientBalanceBefore = recipientWallet.balance;

      // Check sender has sufficient balance
      if (senderBalanceBefore < amount) {
        throw new AppError(
          "Insufficient balance",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INSUFFICIENT_BALANCE
        );
      }

      const senderBalanceAfter = senderBalanceBefore - amount;
      const recipientBalanceAfter = recipientBalanceBefore + amount;

      // Debit sender wallet
      await Wallet.findByIdAndUpdate(
        senderWallet._id,
        { $inc: { balance: -amount } },
        { session }
      );

      // Credit recipient wallet
      await Wallet.findByIdAndUpdate(
        recipientWallet._id,
        { $inc: { balance: amount } },
        { session }
      );

      // Create sender transaction (DEBIT)
      await Transaction.create(
        [
          {
            walletId: senderWallet._id,
            sourceId: new Types.ObjectId(senderId),
            recipientId: recipient.id,
            reference: senderReference,
            idempotencyKey: transferId, // Link both transactions
            amount,
            direction: "DEBIT",
            type: "wallet_transfer",
            provider: "internal",
            remark,
            purpose: "wallet_to_wallet_transfer",
            status: "success",
            balanceBefore: senderBalanceBefore,
            balanceAfter: senderBalanceAfter,
            initiatedBy: new Types.ObjectId(senderId),
            initiatedByType: "user",
            meta: {
              transferId,
              recipientUsername: recipient.username,
              recipientEmail: recipient.email,
              recipientId: recipient.id.toString(),
            },
          },
        ],
        { session }
      );

      // Create recipient transaction (CREDIT)
      await Transaction.create(
        [
          {
            walletId: recipientWallet._id,
            sourceId: new Types.ObjectId(senderId),
            recipientId: recipient.id,
            reference: recipientReference,
            idempotencyKey: `${transferId}_recipient`, // Different key for recipient
            amount,
            direction: "CREDIT",
            type: "wallet_transfer",
            provider: "internal",
            remark,
            purpose: "wallet_to_wallet_transfer",
            status: "success",
            balanceBefore: recipientBalanceBefore,
            balanceAfter: recipientBalanceAfter,
            initiatedBy: new Types.ObjectId(senderId), // Sender initiated
            initiatedByType: "user",
            meta: {
              transferId,
              senderInfo: "Transfer received",
              senderId: senderId,
            },
          },
        ],
        { session }
      );

      // Commit all changes atomically
      await session.commitTransaction();

      // Invalidate cache (outside session)
      await this.cacheService.delete(CACHE_KEYS.USER_WALLET(senderId));
      await this.cacheService.delete(
        CACHE_KEYS.USER_WALLET(recipient.id.toString())
      );

      // Send notifications (outside session)
      await this.notificationService.createNotification({
        type: "wallet_debit",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(senderId),
        data: {
          amount,
          balance: senderBalanceAfter,
          reason: `Transfer to ${recipient.username || recipient.email}`,
          reference: senderReference,
        },
        sendEmail: true,
        sendSMS: false,
        sendPush: true,
      });

      await this.notificationService.createNotification({
        type: "wallet_credit",
        notifiableType: "User",
        notifiableId: recipient.id,
        data: {
          amount,
          balance: recipientBalanceAfter,
          reason: "Transfer received",
          reference: recipientReference,
        },
        sendEmail: true,
        sendSMS: false,
        sendPush: true,
      });

      logger.info(
        `Transfer completed: ${transferId} - ${senderId} → ${recipient.id}`
      );

      return {
        reference: senderReference,
        transferId,
        amount,
        senderBalance: senderBalanceAfter,
        recipient: {
          id: recipient._id,
          username: recipient.username,
          email: recipient.email,
        },
      };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error("Transfer failed:", error);
      throw error;
    } finally {
      session.endSession();
    }
  }

  async fundWallet(userId: string, amount: number): Promise<any> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // TODO: Implement payment gateway integration
    // This should:
    // 1. Generate payment reference
    // 2. Create pending transaction
    // 3. Return payment URL/details
    // 4. Handle webhook callback to credit wallet

    throw new AppError(
      "Funding method not implemented",
      HTTP_STATUS.NOT_IMPLEMENTED,
      ERROR_CODES.NOT_IMPLEMENTED
    );
  }

  async verifyBeneficiary(identifier: string): Promise<any> {
    let user = await this.userRepository.findByUsername(identifier);
    if (!user) {
      user = await this.userRepository.findByEmail(identifier);
    }
    if (!user) {
      user = await this.userRepository.findByRefCode(identifier);
    }

    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    return {
      id: user._id,
      username: user.username,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
    };
  }

  async getBeneficiaries(userId: string): Promise<any> {
    // Get unique recipients from transaction history
    const transactions = await this.transactionRepository.findWithFilters(
      {
        sourceId: userId,
        type: "wallet_transfer",
        status: "success",
      },
      1,
      100
    );

    const recipientIds = [
      ...new Set(
        transactions.data
          .map((t: any) => t.recipientId?.toString())
          .filter(Boolean)
      ),
    ];

    const beneficiaries = await Promise.all(
      recipientIds.map(async (id) => {
        const user = await this.userRepository.findById(id);
        return user
          ? {
              id: user._id,
              username: user.username,
              email: user.email,
              firstname: user.firstname,
              lastname: user.lastname,
            }
          : null;
      })
    );

    return beneficiaries.filter(Boolean);
  }

  async searchBeneficiaries(query: string): Promise<any> {
    const users = await this.userRepository.find({
      $or: [
        { username: new RegExp(query, "i") },
        { email: new RegExp(query, "i") },
        { firstname: new RegExp(query, "i") },
        { lastname: new RegExp(query, "i") },
      ],
      status: "active",
    });

    return users.slice(0, 10).map((user) => ({
      id: user._id,
      username: user.username,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
    }));
  }
}
