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
import { comparePassword } from "@/utils/cryptography";
import { UserRepository } from "@/repositories/UserRepository";
import { PaymentService } from "./PaymentService";
import logger from "@/logger";

export class WithdrawalService {
  private bankAccountRepository: BankAccountRepository;
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;
  private paymentService: PaymentService;
  private transactionRepository: TransactionRepository;
  private BankModel: typeof Bank;
  
  constructor(BankModel = Bank) {
    this.bankAccountRepository = new BankAccountRepository();
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.userRepository = new UserRepository();
    this.paymentService = new PaymentService();
    this.transactionRepository = new TransactionRepository();
    this.BankModel = BankModel;
  }

  async createWithdrawalRequest(data: {
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
    const bank = await this.BankModel.findById(bankAccount.bankId.toString());
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

    // Create Transaction record
    const transaction = await Transaction.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      direction: "DEBIT",
      type: "withdrawal",
      provider: data.provider || "flutterwave",
      status: "processing",
      purpose: "withdrawal",
      meta: {
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        bankName: bank.name,
        bankCode: bank.flutterwaveCode,
      },
    });

    try {
      const result = await this.paymentService.processWithdrawal({
        withdrawalId: transaction.id.toString(),
        userId: data.userId,
        amount: data.amount,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        bankCode: bank.flutterwaveCode!,
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
        paymentDetails: result,
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

  async bankTransferRequest(data: {
    userId: string;
    amount: number;
    pin?: string;
    accountNumber: string;
    accountName?: string;
    bankCode: string;
    provider?: "flutterwave" | "saveHaven" | "monnify";
  }) {
    const reference = generateReference("BTR");

    if (!data.pin) {
      throw new AppError(
        "Pin is required",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Checking pin validity
    const isPinValid = await comparePassword(data.pin, user.pin!);
    if (!isPinValid) {
      throw new AppError(
        "Invalid PIN",
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

    // Check balance
    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Get bank details
    const bank = await this.BankModel.findOne({
      flutterwaveCode: data.bankCode,
    });
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

    // Create transaction record
    const transaction = await Transaction.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      direction: "DEBIT",
      type: "bank_transfer",
      provider: data.provider || "flutterwave",
      status: "pending",
      purpose: "bank_transfer",
      meta: {
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankName: bank.name,
        bankCode: data.bankCode,
      },
    });

    try {
      const result = await this.paymentService.processWithdrawal({
        withdrawalId: transaction.id.toString(),
        userId: data.userId,
        amount: data.amount,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bankCode: data.bankCode,
        bankName: bank.name,
        reference,
        provider: data.provider || "flutterwave",
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
        paymentDetails: result,
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