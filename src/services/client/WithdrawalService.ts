import { Transaction } from "@/models/wallet/Transaction";
import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletService } from "./WalletService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { generateReference } from "@/utils/helpers";
import { Types } from "mongoose";
import { Bank } from "@/models/reference/Bank";
import { UserRepository } from "@/repositories/UserRepository";
import { PaymentService } from "./PaymentService";
import logger from "@/logger";
import { BankRepository } from "@/repositories/BankRepository";

export class WithdrawalService {
  private bankAccountRepository: BankAccountRepository;
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;
  private paymentService: PaymentService;
  private transactionRepository: TransactionRepository;
  private bankRepository: BankRepository;

  constructor(BankModel = Bank) {
    this.bankAccountRepository = new BankAccountRepository();
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.userRepository = new UserRepository();
    this.paymentService = new PaymentService();
    this.transactionRepository = new TransactionRepository();
    this.bankRepository = new BankRepository();
  }

  async withdrawFunds(data: {
    userId: string;
    amount: number;
    bankAccountId: string;
    provider?: "flutterwave" | "saveHaven" | "monnify";
  }) {
    const reference = generateReference("WTH");

    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
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

    // Get bank details
    const bank = await this.bankRepository.findBySavehavenCode(
      bankAccount.bankCode
    );
    if (!bank) {
      throw new AppError(
        "Bank not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
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

    // Check balance
    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct from wallet (pending reversal if declined)
    await this.walletService.debitWallet(
      data.userId,
      data.amount,
      `Withdrawal request ${reference}`,
      "main"
    );

    let bankCode;
    if (data.provider === "saveHaven") {
      bankCode = bank.savehavenCode;
    } else if (data.provider === "monnify") {
      bankCode = bank.monnifyCode;
    } else {
      bankCode = bank.flutterwaveCode;
    }

    // Create Transaction record
    const transaction = await Transaction.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      direction: "DEBIT",
      type: "withdrawal",
      provider: data.provider || "flutterwave",
      remark: `Withdrawal to ${bankAccount.accountNumber} (${bank.name})`,
      status: "processing",
      purpose: "withdrawal",
      meta: {
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        bankName: bank.name,
        bankCode,
      },
    });

    try {
      const result = await this.paymentService.processWithdrawal({
        withdrawalId: transaction.id.toString(),
        userId: data.userId,
        amount: data.amount,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        bankCode: bankCode!,
        bankName: bank.name,
        reference,
        provider: data.provider || "flutterwave",
      });

      // Update transaction with payment details
      await this.transactionRepository.update(transaction.id.toString(), {
        providerReference: result.reference,
        meta: {
          ...transaction.meta,
          transferId: result.transferId,
          provider: result.provider,
        },
      });

      // Send notification for successful initiation
      await this.notificationRepository.create({
        type: "withdrawal_initiated",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          amount: data.amount,
          balance: wallet.balance - data.amount,
          reference,
          accountNumber: bankAccount.accountNumber,
          bankName: bank.name,
          status: "processing",
        },
      });

      return {
        ...transaction.toObject(),
        status: "processing",
        // paymentDetails: result,
      };
    } catch (error: any) {
      // Revert wallet debit
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        `Withdrawal reversal - ${reference}`,
        "main"
      );

      // Update transaction status to failed
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "failed",
        meta: {
          ...transaction.meta,
          error: error.message,
          failedAt: new Date(),
        },
      });

      // Send failure notification
      await this.notificationRepository.create({
        type: "withdrawal_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          amount: data.amount,
          reference,
          reason: error.message,
        },
      });

      logger.error(`Withdrawal failed for ${reference}:`, error);

      throw new AppError(
        error.message || "Payment processing failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  async bankTransfer(data: {
    userId: string;
    amount: number;
    accountNumber: string;
    accountName?: string;
    bankCode: string;
    provider?: "flutterwave" | "saveHaven" | "monnify";
  }) {
    const reference = generateReference("BTR");

    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
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

    // Check balance
    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    const bank = await this.bankRepository.findBySavehavenCode(data.bankCode);

    if (!bank) {
      throw new AppError(
        "Bank not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Validate account name is provided (required for transfers)
    if (!data.accountName) {
      throw new AppError(
        "Account name is required for bank transfers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Deduct from wallet (pending reversal if declined)
    await this.walletService.debitWallet(
      data.userId,
      data.amount,
      `Bank transfer ${reference}`,
      "main"
    );

    let bankCode;
    if (data.provider === "saveHaven") {
      bankCode = bank.savehavenCode;
    } else if (data.provider === "monnify") {
      bankCode = bank.monnifyCode;
    } else if (data.provider === "flutterwave") {
      bankCode = bank.flutterwaveCode;
    } else {
      bankCode = bank.savehavenCode;
    }

    // Create transaction record
    const transaction = await Transaction.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      direction: "DEBIT",
      type: "bank_transfer",
      provider: data.provider || "saveHaven",
      status: "pending",
      purpose: "bank_transfer",
      meta: {
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankName: bank.name,
        bankCode,
      },
    });

    try {
      const result = await this.paymentService.processWithdrawal({
        withdrawalId: transaction.id.toString(),
        userId: data.userId,
        amount: data.amount,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bankCode: bankCode!,
        bankName: bank.name,
        reference,
        provider: data.provider || "saveHaven",
      });

      // Update transaction with payment details
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "processing",
        providerReference: result.reference,
        meta: {
          ...transaction.meta,
          transferId: result.transferId,
          provider: result.provider,
        },
      });

      // Send notification for successful initiation
      await this.notificationRepository.create({
        type: "bank_transfer_initiated",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          amount: data.amount,
          balance: wallet.balance - data.amount,
          reference,
          accountNumber: data.accountNumber,
          accountName: data.accountName,
          bankName: bank.name,
          status: "processing",
        },
      });

      return {
        ...transaction.toObject(),
        status: "processing",
        // paymentDetails: result,
      };
    } catch (error: any) {
      // Revert wallet debit if payment processing fails
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        `Bank transfer reversal - ${reference}`,
        "main"
      );

      // Update transaction status to failed
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "failed",
        meta: {
          ...transaction.meta,
          error: error.message,
          failedAt: new Date(),
        },
      });

      // Send failure notification
      await this.notificationRepository.create({
        type: "bank_transfer_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          amount: data.amount,
          reference,
          accountNumber: data.accountNumber,
          bankName: bank.name,
          reason: error.message,
        },
      });

      logger.error(`Bank transfer failed for ${reference}:`, error);

      throw new AppError(
        error.message || "Bank transfer processing failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INTERNAL_ERROR
      );
    }
  }

  async getWithdrawalRequests(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {
      sourceId: new Types.ObjectId(userId),
      type: { $in: ["withdrawal", "bank_transfer"] },
    };

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

  async getWithdrawalRequestById(requestId: string) {
    const transaction = await this.transactionRepository.findById(requestId);
    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Verify it's a withdrawal or bank_transfer type
    if (!["withdrawal", "bank_transfer"].includes(transaction.type)) {
      throw new AppError(
        "Invalid transaction type",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return transaction;
  }
}
