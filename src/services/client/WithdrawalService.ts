import { Transaction } from "@/models/wallet/Transaction";
import { Wallet } from "@/models/wallet/Wallet";
import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletRepository } from "@/repositories/WalletRepository";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { generateReference } from "@/utils/helpers";
import { Types } from "mongoose";
import { UserRepository } from "@/repositories/UserRepository";
import { BankRepository } from "@/repositories/BankRepository";
import { SaveHavenService } from "@/services/client/SaveHavenService";
import { MonnifyService } from "./MonnifyService";
import { FlutterwaveService } from "./FlutterwaveService";
import logger from "@/logger";
import mongoose from "mongoose";

export class WithdrawalService {
  private bankAccountRepository: BankAccountRepository;
  private walletRepository: WalletRepository;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;
  private transactionRepository: TransactionRepository;
  private bankRepository: BankRepository;
  private saveHavenService: SaveHavenService;
  private monnifyService: MonnifyService;
  private flutterwaveService: FlutterwaveService;

  constructor() {
    this.bankAccountRepository = new BankAccountRepository();
    this.walletRepository = new WalletRepository();
    this.notificationRepository = new NotificationRepository();
    this.userRepository = new UserRepository();
    this.transactionRepository = new TransactionRepository();
    this.bankRepository = new BankRepository();
    this.saveHavenService = new SaveHavenService();
    this.monnifyService = new MonnifyService();
    this.flutterwaveService = new FlutterwaveService();
  }

  async withdrawFunds(data: {
    userId: string;
    amount: number;
    bankAccountId: string;
    provider?: "flutterwave" | "saveHaven" | "monnify";
  }) {
    const reference = generateReference("WTH");
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate user
      const user = await this.userRepository.findById(data.userId);
      if (!user) {
        throw new AppError(
          "User not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      // 2. Validate bank account
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

      // 3. Get bank details
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

      // 4. Check idempotency - prevent duplicate withdrawals
      const existingTransaction = await Transaction.findOne({
        idempotencyKey: reference,
      });
      if (existingTransaction) {
        logger.warn(`Duplicate withdrawal attempt: ${reference}`);
        await session.abortTransaction();
        return existingTransaction;
      }

      // 5. Get wallet and check balance BEFORE any changes
      const wallet = await this.walletRepository.findByUserId(data.userId);
      if (!wallet) {
        throw new AppError(
          "Wallet not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      const balanceBefore = wallet.balance;

      if (balanceBefore < data.amount) {
        throw new AppError(
          "Insufficient wallet balance",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INSUFFICIENT_BALANCE
        );
      }

      const balanceAfter = balanceBefore - data.amount;

      // 6. Determine correct bank code for provider
      let bankCode: string | undefined;
      const provider = data.provider || "flutterwave";

      if (provider === "saveHaven") {
        bankCode = bank.savehavenCode;
      } else if (provider === "monnify") {
        bankCode = bank.monnifyCode;
      } else {
        bankCode = bank.flutterwaveCode;
      }

      if (!bankCode) {
        throw new AppError(
          `Bank code not available for provider: ${provider}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // 7. Create Transaction record (processing state)
      const transaction = await Transaction.create(
        [
          {
            walletId: wallet._id,
            sourceId: new Types.ObjectId(data.userId),
            reference,
            idempotencyKey: reference,
            amount: data.amount,
            direction: "DEBIT",
            type: "withdrawal",
            provider: provider,
            remark: `Withdrawal to ${bankAccount.accountNumber} (${bank.name})`,
            status: "processing",
            purpose: "withdrawal",
            balanceBefore,
            balanceAfter,
            initiatedBy: new Types.ObjectId(data.userId),
            initiatedByType: "user",
            meta: {
              accountNumber: bankAccount.accountNumber,
              accountName: bankAccount.accountName,
              bankName: bank.name,
              bankCode,
            },
          },
        ],
        { session }
      );

      // 8. Debit wallet
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: -data.amount } },
        { session }
      );

      // Commit the transaction (wallet debited, Transaction record created)
      await session.commitTransaction();

      // 9. Call provider (OUTSIDE session - external call)
      try {
        let providerResult;

        switch (provider) {
          case "saveHaven":
            providerResult = await this.saveHavenService.initiateTransfer({
              amount: data.amount,
              account_number: bankAccount.accountNumber,
              bank_code: bankCode,
              narration: `Withdrawal - ${reference}`,
              reference: reference,
            });
            break;

          case "monnify":
            providerResult = await this.monnifyService.initiateTransfer({
              amount: data.amount,
              destinationBankCode: bankCode,
              destinationAccountNumber: bankAccount.accountNumber,
              narration: `Withdrawal - ${reference}`,
              reference: reference,
              currency: "NGN",
              async: false,
            });
            break;

          case "flutterwave":
            providerResult = await this.flutterwaveService.initiateTransfer({
              accountBank: bankCode,
              accountNumber: bankAccount.accountNumber,
              amount: data.amount,
              narration: `Withdrawal - ${reference}`,
              reference: reference,
              currency: "NGN",
              beneficiaryName: bankAccount.accountName,
              callbackUrl: `${process.env.BASE_URL}/api/v1/webhooks/flutterwave/transfer`,
            });
            break;

          default:
            throw new AppError(
              "Invalid payment provider",
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR
            );
        }

        // 10. Update Transaction with provider response
        await this.transactionRepository.update(transaction[0].id.toString(), {
          providerReference:
            providerResult.reference ||
            providerResult.transactionReference ||
            providerResult.id?.toString(),
          status: "processing",
          meta: {
            ...transaction[0].meta,
            transferId:
              providerResult.id ||
              providerResult.reference ||
              providerResult.transactionReference,
            providerStatus: providerResult.status,
            providerResponse: providerResult,
          },
        });

        // 10. Update Transaction with provider response
        await this.transactionRepository.update(transaction[0].id.toString(), {
          providerReference: providerResult._id, 
          status: "processing",
          meta: {
            ...transaction[0].meta,
            transferId: providerResult._id, 
            sessionId: providerResult.sessionId,
            nameEnquiryReference: providerResult.nameEnquiryReference,
            paymentReference: providerResult.paymentReference,
            providerStatus: providerResult.status,
            providerResponse: providerResult,
          },
        });

        // 11. Send notification for successful initiation
        await this.notificationRepository.create({
          type: "withdrawal_initiated",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            amount: data.amount,
            balance: balanceAfter,
            reference,
            accountNumber: bankAccount.accountNumber,
            bankName: bank.name,
            status: "processing",
          },
        });

        logger.info(`Withdrawal initiated successfully: ${reference}`);

        return {
          ...transaction[0].toObject(),
          status: "processing",
        };
      } catch (providerError: any) {
        // 12. Provider call failed - REVERSE the debit
        const reverseSession = await mongoose.startSession();
        reverseSession.startTransaction();

        try {
          // Update transaction to failed
          await Transaction.findByIdAndUpdate(
            transaction[0]._id,
            {
              status: "failed",
              meta: {
                ...transaction[0].meta,
                error: providerError.message,
                failedAt: new Date(),
              },
            },
            { session: reverseSession }
          );

          // Credit wallet back (reverse the debit)
          await Wallet.findByIdAndUpdate(
            wallet._id,
            { $inc: { balance: data.amount } },
            { session: reverseSession }
          );

          await reverseSession.commitTransaction();

          // Send failure notification
          await this.notificationRepository.create({
            type: "withdrawal_failed",
            notifiableType: "User",
            notifiableId: new Types.ObjectId(data.userId),
            data: {
              amount: data.amount,
              reference,
              reason: providerError.message,
            },
          });

          logger.error(`Withdrawal failed for ${reference}:`, providerError);
        } catch (reversalError) {
          await reverseSession.abortTransaction();
          logger.error(
            `CRITICAL: Failed to reverse withdrawal ${reference}:`,
            reversalError
          );
        } finally {
          reverseSession.endSession();
        }

        throw new AppError(
          providerError.message || "Payment processing failed",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Validate user
      const user = await this.userRepository.findById(data.userId);
      if (!user) {
        throw new AppError(
          "User not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      // 2. Get bank details
      const bank = await this.bankRepository.findBySavehavenCode(data.bankCode);
      if (!bank) {
        throw new AppError(
          "Bank not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      // 3. Validate account name is provided
      if (!data.accountName) {
        throw new AppError(
          "Account name is required for bank transfers",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // 4. Check idempotency
      const existingTransaction = await Transaction.findOne({
        idempotencyKey: reference,
      });
      if (existingTransaction) {
        logger.warn(`Duplicate bank transfer attempt: ${reference}`);
        await session.abortTransaction();
        return existingTransaction;
      }

      // 5. Get wallet and check balance
      const wallet = await this.walletRepository.findByUserId(data.userId);
      if (!wallet) {
        throw new AppError(
          "Wallet not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      const balanceBefore = wallet.balance;

      if (balanceBefore < data.amount) {
        throw new AppError(
          "Insufficient wallet balance",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INSUFFICIENT_BALANCE
        );
      }

      const balanceAfter = balanceBefore - data.amount;

      // 6. Determine correct bank code for provider
      let bankCode: string | undefined;
      const provider = data.provider || "saveHaven";

      if (provider === "saveHaven") {
        bankCode = bank.savehavenCode;
      } else if (provider === "monnify") {
        bankCode = bank.monnifyCode;
      } else if (provider === "flutterwave") {
        bankCode = bank.flutterwaveCode;
      } else {
        bankCode = bank.savehavenCode;
      }

      if (!bankCode) {
        throw new AppError(
          `Bank code not available for provider: ${provider}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // 7. Create transaction record (processing state)
      const transaction = await Transaction.create(
        [
          {
            walletId: wallet._id,
            sourceId: new Types.ObjectId(data.userId),
            reference,
            idempotencyKey: reference,
            amount: data.amount,
            direction: "DEBIT",
            type: "bank_transfer",
            provider: provider,
            status: "processing",
            purpose: "bank_transfer",
            balanceBefore,
            balanceAfter,
            initiatedBy: new Types.ObjectId(data.userId),
            initiatedByType: "user",
            meta: {
              accountName: data.accountName,
              accountNumber: data.accountNumber,
              bankName: bank.name,
              bankCode,
            },
          },
        ],
        { session }
      );

      // 8. Debit wallet
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: -data.amount } },
        { session }
      );

      await session.commitTransaction();

      // 9. Call provider (OUTSIDE session)
      try {
        let providerResult;

        switch (provider) {
          case "saveHaven":
            providerResult = await this.saveHavenService.initiateTransfer({
              amount: data.amount,
              account_number: data.accountNumber,
              bank_code: bankCode,
              narration: `Bank transfer - ${reference}`,
              reference: reference,
            });
            break;

          case "monnify":
            providerResult = await this.monnifyService.initiateTransfer({
              amount: data.amount,
              destinationBankCode: bankCode,
              destinationAccountNumber: data.accountNumber,
              narration: `Bank transfer - ${reference}`,
              reference: reference,
              currency: "NGN",
              async: false,
            });
            break;

          case "flutterwave":
            providerResult = await this.flutterwaveService.initiateTransfer({
              accountBank: bankCode,
              accountNumber: data.accountNumber,
              amount: data.amount,
              narration: `Bank transfer - ${reference}`,
              reference: reference,
              currency: "NGN",
              beneficiaryName: data.accountName,
              callbackUrl: `${process.env.BASE_URL}/api/v1/webhooks/flutterwave/transfer`,
            });
            break;

          default:
            throw new AppError(
              "Invalid payment provider",
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR
            );
        }

        // 10. Update transaction with provider details
        await this.transactionRepository.update(transaction[0].id.toString(), {
          providerReference:
            providerResult.reference ||
            providerResult.transactionReference ||
            providerResult.id?.toString(),
          status: "processing",
          meta: {
            ...transaction[0].meta,
            transferId:
              providerResult.id ||
              providerResult.reference ||
              providerResult.transactionReference,
            providerStatus: providerResult.status,
            providerResponse: providerResult,
          },
        });

        // 11. Send notification
        await this.notificationRepository.create({
          type: "bank_transfer_initiated",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            amount: data.amount,
            balance: balanceAfter,
            reference,
            accountNumber: data.accountNumber,
            accountName: data.accountName,
            bankName: bank.name,
            status: "processing",
          },
        });

        logger.info(`Bank transfer initiated successfully: ${reference}`);

        return {
          ...transaction[0].toObject(),
          status: "processing",
        };
      } catch (providerError: any) {
        // 12. Provider call failed - REVERSE
        const reverseSession = await mongoose.startSession();
        reverseSession.startTransaction();

        try {
          await Transaction.findByIdAndUpdate(
            transaction[0]._id,
            {
              status: "failed",
              meta: {
                ...transaction[0].meta,
                error: providerError.message,
                failedAt: new Date(),
              },
            },
            { session: reverseSession }
          );

          await Wallet.findByIdAndUpdate(
            wallet._id,
            { $inc: { balance: data.amount } },
            { session: reverseSession }
          );

          await reverseSession.commitTransaction();

          await this.notificationRepository.create({
            type: "bank_transfer_failed",
            notifiableType: "User",
            notifiableId: new Types.ObjectId(data.userId),
            data: {
              amount: data.amount,
              reference,
              accountNumber: data.accountNumber,
              bankName: bank.name,
              reason: providerError.message,
            },
          });

          logger.error(`Bank transfer failed for ${reference}:`, providerError);
        } catch (reversalError) {
          await reverseSession.abortTransaction();
          logger.error(
            `CRITICAL: Failed to reverse bank transfer ${reference}:`,
            reversalError
          );
        } finally {
          reverseSession.endSession();
        }

        throw new AppError(
          providerError.message || "Bank transfer processing failed",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.INTERNAL_ERROR
        );
      }
    } catch (error: any) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
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
