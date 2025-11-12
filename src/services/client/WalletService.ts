import { WalletRepository } from "@/repositories/WalletRepository";
import { LedgerRepository } from "@/repositories/LedgerRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { UserRepository } from "@/repositories/UserRepository";
import { AppError } from "@/middlewares/errorHandler";
import {
  HTTP_STATUS,
  ERROR_CODES,
  CACHE_KEYS,
  WALLET_TYPES,
  LEDGER_TYPE,
} from "@/utils/constants";
import { Types } from "mongoose";
import { generateReference } from "@/utils/helpers";
import { CacheService } from "../CacheService";

export class WalletService {
  private walletRepository: WalletRepository;
  private ledgerRepository: LedgerRepository;
  private cacheService: CacheService;
  private transactionRepository: TransactionRepository;
  private userRepository: UserRepository;
  private notificationRepository?: NotificationRepository;
  constructor() {
    this.walletRepository = new WalletRepository();
    this.ledgerRepository = new LedgerRepository();
    this.cacheService = new CacheService();
    this.transactionRepository = new TransactionRepository();
    this.userRepository = new UserRepository();
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
    walletType: "main" | "bonus" | "commission" = "main"
  ): Promise<any> {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const oldBalance = wallet.balance;
    const newBalance = oldBalance + Number(amount);


    // Update wallet balance
    await this.walletRepository.updateBalance(wallet.id.toString(), newBalance);

    // Create ledger entry
    await this.ledgerRepository.create({
      ledgerableType: "Wallet",
      ledgerableId: wallet.id,
      source: "system",
      destination: wallet.id.toString(),
      oldBalance,
      newBalance,
      type: LEDGER_TYPE.CREDIT,
      reason,
      amount,
      currencyCode: "NGN",
    });

    // Invalidate cache
    await this.cacheService.delete(CACHE_KEYS.USER_WALLET(userId.toString()));

    // Send notification
    if (this.notificationRepository) {
      await this.notificationRepository.create({
        type: "wallet_credit",
        notifiableType: "User",
        notifiableId: userId as Types.ObjectId,
        data: {
          amount,
          balance: newBalance,
          reason,
        },
      });
    }

    return {
      walletId: wallet._id,
      oldBalance,
      newBalance,
      amount,
      type: LEDGER_TYPE.CREDIT,
    };
  }

  async debitWallet(
    userId: string | Types.ObjectId,
    amount: number,
    reason: string,
    walletType: "main" | "bonus" | "commission" = "main"
  ): Promise<any> {
    const wallet = await this.walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const oldBalance = wallet.balance;
    if (oldBalance < amount) {
      throw new AppError(
        "Insufficient balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    const newBalance = oldBalance - amount;

    // Update wallet balance
    await this.walletRepository.updateBalance(wallet.id.toString(), newBalance);

    // Create ledger entry
    await this.ledgerRepository.create({
      ledgerableType: "Wallet",
      ledgerableId: wallet.id,
      source: wallet.id.toString(),
      destination: "system",
      oldBalance,
      newBalance,
      type: LEDGER_TYPE.DEBIT,
      reason,
      amount,
      currencyCode: "NGN",
    });

    // Invalidate cache
    await this.cacheService.delete(CACHE_KEYS.USER_WALLET(userId.toString()));

    // Send notification
    if (this.notificationRepository) {
      await this.notificationRepository.create({
        type: "wallet_debit",
        notifiableType: "User",
        notifiableId: userId as Types.ObjectId,
        data: {
          amount,
          balance: newBalance,
          reason,
        },
      });
    }

    return {
      walletId: wallet._id,
      oldBalance,
      newBalance,
      amount,
      type: LEDGER_TYPE.DEBIT,
    };
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

  async getLedgerEntries(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const wallets = await this.walletRepository.findAllByUserId(userId);
    const walletIds = wallets.map((w) => w._id);

    const query: any = { ledgerableId: { $in: walletIds } };

    if (filters.type) {
      query.type = filters.type;
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

    return this.ledgerRepository.findWithFilters(query, page, limit);
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

    const ledgerEntries = await this.ledgerRepository.findWithFilters(
      {
        ledgerableId: wallet._id,
        createdAt: { $gte: startDate },
      },
      1,
      1000
    );

    return {
      currentBalance: wallet.balance,
      history: ledgerEntries.data.map((entry: any) => ({
        date: entry.createdAt,
        balance: entry.newBalance,
        amount: entry.amount,
        type: entry.type,
        reason: entry.reason,
      })),
    };
  }

  async transferFunds(
    senderId: string,
    recipientIdentifier: string,
    amount: number,
    remark?: string
  ): Promise<any> {
    // Find recipient by username, email, or refCode
    let recipient = await this.userRepository.findByUsername(
      recipientIdentifier
    );
    if (!recipient) {
      recipient = await this.userRepository.findByEmail(recipientIdentifier);
    }
    if (!recipient) {
      recipient = await this.userRepository.findByRefCode(recipientIdentifier);
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

    // Debit sender
    await this.debitWallet(
      senderId,
      amount,
      `Transfer to ${recipient.username || recipient.email}`,
      "main"
    );

    // Credit recipient
    await this.creditWallet(
      recipient.id,
      amount,
      `Transfer from sender`,
      "main"
    );

    // Create transaction records
    const reference = generateReference("TRF");
    await this.transactionRepository.create({
      reference,
      sourceId: new Types.ObjectId(senderId),
      recipientId: recipient.id,
      amount,
      type: "wallet_transfer",
      provider: "internal",
      remark,
      status: "success",
    });

    return {
      reference,
      amount,
      recipient: {
        id: recipient._id,
        username: recipient.username,
        email: recipient.email,
      },
      status: "success",
    };
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
