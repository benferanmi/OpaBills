import { WithdrawalRepository } from "@/repositories/WithdrawalRepository";
import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { generateReference } from "@/utils/helpers";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { Bank } from "@/models/reference/Bank";
import { comparePassword } from "@/utils/cryptography";
import { UserRepository } from "@/repositories/UserRepository";
import { PaymentService } from "./PaymentService";
import logger from "@/logger";

export class WithdrawalService {
  private withdrawalRepository: WithdrawalRepository;
  private bankAccountRepository: BankAccountRepository;
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;
  private paymentService: PaymentService;
  private BankModel: typeof Bank;
  constructor(BankModel = Bank) {
    this.withdrawalRepository = new WithdrawalRepository();
    this.bankAccountRepository = new BankAccountRepository();
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.userRepository = new UserRepository();
    this.paymentService = new PaymentService();
    this.BankModel = BankModel;
  }

  async createWithdrawalRequest(data: {
    userId: string;
    amount: number;
    bankAccountId: string;
    pin?: string;
    provider?:  "flutterwave" | "saveHaven" | "monnify";
  }) {
    const reference = generateReference("WTH");

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

    // checking pin validity
    const isPinValid = await comparePassword(data.pin, user.pin!);
    if (!isPinValid) {
      throw new AppError(
        "Invalid PIN",
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

    // Create withdrawal request
    const withdrawalRequest = await this.withdrawalRepository.create({
      userId: new Types.ObjectId(data.userId),
      reference,
      provider: data.provider || "flutterwave",
      amount: data.amount,
      accountName: bankAccount.accountName,
      accountNumber: bankAccount.accountNumber,
      bankName: bank.name,
      bankCode: bank.flutterwaveCode,
      status: "pending",
    });

    try {
      const result = await this.paymentService.processWithdrawal({
        withdrawalId: withdrawalRequest.id.toString(),
        userId: data.userId,
        amount: data.amount,
        accountNumber: bankAccount.accountNumber,
        accountName: bankAccount.accountName,
        //Todo: Updating bank code based on the provider being used
        bankCode: bank.flutterwaveCode!,
        bankName: bank.name,
        reference,
        provider: data.provider || "flutterwave",
      });

      // Update withdrawal request with payment details and status
      await this.withdrawalRepository.update(withdrawalRequest.id.toString(), {
        status: "processing",
        meta: {
          paymentReference: result.reference,
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
        ...withdrawalRequest.toObject(),
        status: "processing",
        paymentDetails: result,
      };
    } catch (error: any) {
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        `Withdrawal reversal - ${reference}`,
        "main"
      );

      // Update withdrawal status to failed
      await this.withdrawalRepository.update(withdrawalRequest.id.toString(), {
        status: "failed",
        meta: {
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
    const bank = await this.BankModel.findOne({ flutterwaveCode: data.bankCode });
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

    // Create withdrawal request
    const withdrawalRequest = await this.withdrawalRepository.create({
      userId: new Types.ObjectId(data.userId),
      reference,
      provider: data.provider || "flutterwave",
      amount: data.amount,
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      bankName: bank.name,
      bankCode: data.bankCode,
      status: "pending",
      type: "bank_transfer",
    });


    try {
      const result = await this.paymentService.processWithdrawal({
        withdrawalId: withdrawalRequest.id.toString(),
        userId: data.userId,
        amount: data.amount,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bankCode: data.bankCode,
        bankName: bank.name,
        reference,
        provider: data.provider || "flutterwave",
      });

      await this.withdrawalRepository.update(withdrawalRequest.id.toString(), {
        status: "processing",
        meta: {
          paymentReference: result.reference,
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
        ...withdrawalRequest.toObject(),
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

      // Update withdrawal status to failed
      await this.withdrawalRepository.update(withdrawalRequest.id.toString(), {
        status: "failed",
        meta: {
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
    const query: any = {};

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

    return this.withdrawalRepository.findByUserId(userId, query, page, limit);
  }

  async getWithdrawalRequestById(requestId: string) {
    const request = await this.withdrawalRepository.findById(requestId);
    if (!request) {
      throw new AppError(
        "Withdrawal request not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return request;
  }
}
