import { Transaction } from "@/models/wallet/Transaction";
import { Wallet } from "@/models/wallet/Wallet";
import { Deposit } from "@/models/banking/Deposit";
import { VirtualAccount } from "@/models/banking/VirtualAccount";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { VirtualAccountRepository } from "@/repositories/VirtualAccountRepository";
import { WalletRepository } from "@/repositories/WalletRepository";
import { DepositRepository } from "@/repositories/DepositRepository";
import { WebhookProcessResult } from "@/services/WebhookService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { generateReference } from "@/utils/helpers";
import mongoose from "mongoose";

/**
 * MONNIFY WEBHOOK SERVICE (REFACTORED)
 * Handles business logic for Monnify webhook events
 *
 * ✅ NEW ARCHITECTURE:
 * - NO Payment model usage
 * - Transaction is single source of truth
 * - Deposit model for audit trail only
 * - Atomic operations with sessions
 *
 * Responsibilities:
 * 1. Process wallet funding (SUCCESSFUL_TRANSACTION)
 * 2. Process withdrawal success (SUCCESSFUL_DISBURSEMENT)
 * 3. Process withdrawal failure (FAILED_DISBURSEMENT)
 * 4. Process withdrawal reversal (REVERSED_DISBURSEMENT)
 * 5. Handle unsolicited payments
 * 6. Update Transaction records
 * 7. Credit/debit wallets
 * 8. Send notifications
 */
export class MonnifyWebhookService {
  private notificationRepository: NotificationRepository;
  private transactionRepository: TransactionRepository;
  private virtualAccountRepository: VirtualAccountRepository;
  private walletRepository: WalletRepository;
  private depositRepository: DepositRepository;

  constructor() {
    this.notificationRepository = new NotificationRepository();
    this.transactionRepository = new TransactionRepository();
    this.virtualAccountRepository = new VirtualAccountRepository();
    this.walletRepository = new WalletRepository();
    this.depositRepository = new DepositRepository();
  }

  /**
   * Main entry point for processing Monnify webhooks
   * Routes to appropriate handler based on metadata.eventType
   */
  async processWebhook(webhookData: WebhookProcessResult): Promise<void> {
    const { providerTransactionId, metadata } = webhookData;

    try {
      logger.info("Monnify webhook service: Processing started", {
        providerTransactionId,
        eventType: metadata?.eventType,
        status: webhookData.status,
      });

      // ===
      // STEP 1: Check Idempotency
      // Prevent duplicate processing
      // ===
      const isDuplicate = await this.checkIdempotency(providerTransactionId);
      if (isDuplicate) {
        logger.info("Monnify webhook: Duplicate transaction, skipping", {
          providerTransactionId,
        });
        return;
      }

      // ===
      // STEP 2: Route based on event type
      // ===
      const eventType = metadata?.eventType;

      switch (eventType) {
        case "SUCCESSFUL_TRANSACTION":
          await this.handleSuccessfulTransaction(webhookData);
          break;

        case "SUCCESSFUL_DISBURSEMENT":
          await this.handleSuccessfulDisbursement(webhookData);
          break;

        case "FAILED_DISBURSEMENT":
          await this.handleFailedDisbursement(webhookData);
          break;

        case "REVERSED_DISBURSEMENT":
          await this.handleReversedDisbursement(webhookData);
          break;

        default:
          logger.warn("Monnify webhook: Unsupported event type", {
            eventType,
            reference: webhookData.reference,
          });
          throw new AppError(
            `Unsupported event type: ${eventType}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.VALIDATION_ERROR
          );
      }

      logger.info("Monnify webhook service: Processing completed", {
        providerTransactionId,
        eventType,
      });
    } catch (error) {
      logger.error("Monnify webhook service: Processing error", {
        error,
        providerTransactionId,
      });
      throw error;
    }
  }

  /**
   * Handle SUCCESSFUL_TRANSACTION (Wallet Funding)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find user by virtual account
   * 2. Create Deposit record (audit trail)
   * 3. Create Transaction record (user-facing)
   * 4. Credit wallet if successful
   * 5. Send notification
   */
  private async handleSuccessfulTransaction(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { providerTransactionId, providerReference, status, metadata } =
      webhookData;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info("Monnify: Processing wallet funding", {
        providerTransactionId,
        virtualAccountNumber: metadata.virtualAccountNumber,
        settlementAmount: metadata.settlementAmount,
        status,
      });

      // ===
      // STEP 1: Find user by virtual account number
      // ===
      const virtualAccount = await this.virtualAccountRepository.findOne({
        accountNumber: metadata.virtualAccountNumber,
        provider: "monnify",
        isActive: true,
      });

      if (!virtualAccount) {
        await session.abortTransaction();
        logger.error("Monnify: Virtual account not found", {
          accountNumber: metadata.virtualAccountNumber,
          providerTransactionId,
        });
        throw new AppError(
          "Virtual account not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      const userId = virtualAccount.userId;

      logger.info("Monnify: Found virtual account", {
        virtualAccountId: virtualAccount._id,
        userId,
        accountNumber: metadata.virtualAccountNumber,
      });

      // ===
      // STEP 2: Check if deposit already processed (idempotency)
      // ===
      const existingTransaction = await Transaction.findOne({
        $or: [
          { providerReference: providerReference },
          { providerReference: metadata.monnifyTransactionReference },
          { "meta.monnifyPaymentReference": metadata.monnifyPaymentReference },
          { "meta.providerTransactionId": providerTransactionId },
        ],
        provider: "monnify",
        type: "wallet_funding",
      });

      if (existingTransaction) {
        await session.abortTransaction();
        logger.info("Monnify: Deposit already processed", {
          transactionId: existingTransaction._id,
          providerReference,
        });
        return;
      }

      // ===
      // STEP 3: Get wallet and capture balance
      // ===
      const wallet = await this.walletRepository.findByUserId(userId);
      if (!wallet) {
        await session.abortTransaction();
        throw new AppError(
          "Wallet not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      const balanceBefore = wallet.balance;
      const amountToCredit = metadata.settlementAmount; // After fees
      const balanceAfter = balanceBefore + amountToCredit;

      // ===
      // STEP 4: Create Deposit record (audit trail only)
      // ===
      const depositReference = generateReference("DEP");
      const deposit = await Deposit.create(
        [
          {
            userId: userId,
            walletId: wallet._id,
            reference: depositReference,
            provider: "monnify",
            amount: amountToCredit,
            status: "success",
            meta: {
              webhookData: metadata,
              providerReference: providerReference,
              providerTransactionId: providerTransactionId,
              virtualAccountId: virtualAccount._id,
              monnifyTransactionReference: metadata.monnifyTransactionReference,
              monnifyPaymentReference: metadata.monnifyPaymentReference,
              fees: metadata.fees,
              grossAmount: metadata.amountPaid,
              netAmount: metadata.settlementAmount,
              virtualAccountNumber: metadata.virtualAccountNumber,
              virtualBankName: metadata.virtualBankName,
              paymentMethod: metadata.paymentMethod,
              paymentSourceInformation: metadata.paymentSourceInformation,
              customer: metadata.customer,
              paidOn: metadata.paidOn,
              unsolicited: true, // Webhook-based deposits are unsolicited
            },
          },
        ],
        { session }
      );

      logger.info("Monnify: Deposit record created", {
        depositId: deposit[0]._id,
        reference: depositReference,
        userId,
      });

      // ===
      // STEP 5: Create Transaction record (user-facing)
      // ===
      const transactionReference = generateReference("TXN");
      const transaction = await Transaction.create(
        [
          {
            walletId: wallet._id,
            sourceId: userId,
            reference: transactionReference,
            providerReference:
              metadata.monnifyTransactionReference || providerReference,
            idempotencyKey:
              metadata.monnifyPaymentReference || providerReference,
            transactableType: "Deposit",
            transactableId: deposit[0]._id,
            amount: amountToCredit,
            direction: "CREDIT",
            type: "wallet_funding",
            provider: "monnify",
            status: "success",
            purpose: "Wallet funding via Monnify",
            balanceBefore,
            balanceAfter,
            initiatedBy: userId,
            initiatedByType: "system", // Webhook-initiated
            meta: {
              depositId: deposit[0]._id,
              depositReference: depositReference,
              provider: "monnify",
              virtualAccount: {
                accountNumber: metadata.virtualAccountNumber,
                accountName: virtualAccount.accountName,
                bankName: metadata.virtualBankName || virtualAccount.bankName,
              },
              monnifyTransactionReference: metadata.monnifyTransactionReference,
              monnifyPaymentReference: metadata.monnifyPaymentReference,
              fees: metadata.fees,
              grossAmount: metadata.amountPaid,
              netAmount: metadata.settlementAmount,
              paymentMethod: metadata.paymentMethod,
              paymentSourceInformation: metadata.paymentSourceInformation,
              customer: metadata.customer,
              paidOn: metadata.paidOn,
              providerTransactionId: providerTransactionId,
            },
          },
        ],
        { session }
      );

      logger.info("Monnify: Transaction record created", {
        transactionId: transaction[0]._id,
        reference: transactionReference,
        userId,
      });

      // ===
      // STEP 6: Credit wallet
      // ===
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: amountToCredit } },
        { session }
      );

      logger.info("Monnify: Wallet credited", {
        userId: userId.toString(),
        amount: amountToCredit,
        reference: transactionReference,
      });

      // Commit all changes atomically
      await session.commitTransaction();

      // ===
      // STEP 7: Send notification (outside session)
      // ===
      await this.notificationRepository.create({
        type: "payment_success",
        notifiableType: "User",
        notifiableId: userId,
        data: {
          transactionType: "Wallet Funding",
          amount: amountToCredit,
          amountPaid: metadata.amountPaid,
          fees: metadata.fees,
          reference: transactionReference,
          provider: "Monnify",
          paymentMethod: metadata.paymentMethod,
          balance: balanceAfter,
        },
      });

      logger.info("Monnify: Wallet funded successfully", {
        userId: userId.toString(),
        amount: amountToCredit,
        reference: transactionReference,
        providerTransactionId,
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error("Monnify: Wallet funding error", {
        error,
        providerTransactionId,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Handle SUCCESSFUL_DISBURSEMENT (Withdrawal completion)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find Transaction record by reference
   * 2. Update Transaction status
   * 3. Send notification
   */
  private async handleSuccessfulDisbursement(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const {
      reference,
      providerTransactionId,
      providerReference,
      status,
      metadata,
    } = webhookData;

    try {
      logger.info("Monnify: Processing withdrawal webhook", {
        reference,
        providerTransactionId,
        amount: metadata.amount,
        destinationAccount: metadata.destinationAccountNumber,
        status,
      });

      // ===
      // STEP 1: Find Transaction record by reference
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference: reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "monnify",
      });

      if (!transaction) {
        logger.error("Monnify: Withdrawal transaction not found", {
          reference,
          providerTransactionId,
        });
        throw new AppError(
          "Withdrawal transaction not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      logger.info("Monnify: Found transaction record", {
        transactionId: transaction._id,
        reference,
        userId: transaction.sourceId,
        currentStatus: transaction.status,
      });

      // ===
      // STEP 2: Check if already processed (idempotency)
      // ===
      if (transaction.status === "success" || transaction.status === "failed") {
        logger.info("Monnify: Withdrawal already processed", {
          transactionId: transaction._id,
          currentStatus: transaction.status,
          webhookStatus: status,
        });
        return;
      }

      // ===
      // STEP 3: Update Transaction
      // ===
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "success",
        providerReference: metadata.monnifyTransactionReference,
        meta: {
          ...transaction.meta,
          monnifyTransactionReference: metadata.monnifyTransactionReference,
          sessionId: metadata.sessionId,
          transactionDescription: metadata.transactionDescription,
          fee: metadata.fee,
          providerTransactionId: providerTransactionId,
          webhookData: metadata,
          completedOn: metadata.completedOn,
        },
      });

      logger.info("Monnify: Transaction updated to success", {
        transactionId: transaction._id,
        monnifyTransactionReference: metadata.monnifyTransactionReference,
      });

      // ===
      // STEP 4: Send notification
      // ===
      const userId = transaction.sourceId;
      const amount = transaction.amount;
      const transactionType =
        transaction.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal";

      await this.notificationRepository.create({
        type: "withdrawal_completed",
        notifiableType: "User",
        notifiableId: userId,
        data: {
          transactionType,
          amount,
          fee: metadata.fee,
          reference,
          provider: "Monnify",
          destinationAccountNumber: metadata.destinationAccountNumber,
          destinationAccountName: metadata.destinationAccountName,
          destinationBankName: metadata.destinationBankName,
          completedOn: metadata.completedOn,
        },
      });

      logger.info("Monnify: Withdrawal completed successfully", {
        reference,
        amount,
        providerTransactionId,
      });
    } catch (error) {
      logger.error("Monnify: Withdrawal processing error", {
        error,
        reference,
        providerTransactionId,
      });
      throw error;
    }
  }

  /**
   * Handle FAILED_DISBURSEMENT (Withdrawal failure)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find Transaction record by reference
   * 2. Update Transaction status to failed
   * 3. Refund wallet
   * 4. Send notification
   */
  private async handleFailedDisbursement(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerTransactionId, metadata } = webhookData;

    try {
      logger.info("Monnify: Processing failed disbursement", {
        reference,
        providerTransactionId,
        amount: metadata.amount,
        failureReason: metadata.failureReason,
      });

      // ===
      // STEP 1: Find Transaction record
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference: reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "monnify",
      });

      if (!transaction) {
        logger.error("Monnify: Transaction not found for failed disbursement", {
          reference,
        });
        throw new AppError(
          "Transaction not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      // Check if already processed
      if (transaction.status === "failed") {
        logger.info("Monnify: Transaction already marked as failed", {
          transactionId: transaction._id,
        });
        return;
      }

      // ===
      // STEP 2: Update Transaction status
      // ===
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "failed",
        meta: {
          ...transaction.meta,
          monnifyTransactionReference: metadata.monnifyTransactionReference,
          failureReason: metadata.failureReason,
          transactionDescription: metadata.transactionDescription,
          providerTransactionId: providerTransactionId,
          webhookData: metadata,
          completedOn: metadata.completedOn,
        },
      });

      logger.info("Monnify: Transaction marked as failed", {
        transactionId: transaction._id,
      });

      // ===
      // STEP 3: Refund wallet
      // ===
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await Wallet.findByIdAndUpdate(
          transaction.walletId,
          { $inc: { balance: transaction.amount } },
          { session }
        );

        await session.commitTransaction();

        logger.info("Monnify: Wallet refunded for failed withdrawal", {
          userId: transaction.sourceId?.toString(),
          amount: transaction.amount,
          reference,
        });
      } catch (refundError) {
        await session.abortTransaction();
        logger.error("Monnify: Refund failed", {
          error: refundError,
          transactionId: transaction._id,
        });
        throw refundError;
      } finally {
        session.endSession();
      }

      // ===
      // STEP 4: Send notification
      // ===
      await this.notificationRepository.create({
        type: "withdrawal_failed",
        notifiableType: "User",
        notifiableId: transaction.sourceId,
        data: {
          transactionType:
            transaction.type === "bank_transfer"
              ? "Bank Transfer"
              : "Withdrawal",
          amount: transaction.amount,
          reference,
          provider: "Monnify",
          failureReason: metadata.failureReason,
          refunded: true,
        },
      });

      logger.info("Monnify: Failed disbursement processed and refunded", {
        reference,
        amount: transaction.amount,
      });
    } catch (error) {
      logger.error("Monnify: Failed disbursement processing error", {
        error,
        reference,
      });
      throw error;
    }
  }

  /**
   * Handle REVERSED_DISBURSEMENT (Withdrawal reversal)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find Transaction record by reference
   * 2. Update Transaction status to reversed
   * 3. Refund wallet
   * 4. Send notification
   */
  private async handleReversedDisbursement(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerTransactionId, metadata } = webhookData;

    try {
      logger.info("Monnify: Processing reversed disbursement", {
        reference,
        providerTransactionId,
        amount: metadata.amount,
      });

      // ===
      // STEP 1: Find Transaction record
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference: reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "monnify",
      });

      if (!transaction) {
        logger.error(
          "Monnify: Transaction not found for reversed disbursement",
          { reference }
        );
        throw new AppError(
          "Transaction not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      // Check if already processed
      if (transaction.status === "reversed") {
        logger.info("Monnify: Transaction already marked as reversed", {
          transactionId: transaction._id,
        });
        return;
      }

      // ===
      // STEP 2: Update Transaction status
      // ===
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "reversed",
        meta: {
          ...transaction.meta,
          monnifyTransactionReference: metadata.monnifyTransactionReference,
          reversalReason: "Disbursement reversed by Monnify",
          providerTransactionId: providerTransactionId,
          webhookData: metadata,
          completedOn: metadata.completedOn,
        },
      });

      logger.info("Monnify: Transaction marked as reversed", {
        transactionId: transaction._id,
      });

      // ===
      // STEP 3: Refund wallet
      // ===
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        await Wallet.findByIdAndUpdate(
          transaction.walletId,
          { $inc: { balance: transaction.amount } },
          { session }
        );

        await session.commitTransaction();

        logger.info("Monnify: Wallet refunded for reversed withdrawal", {
          userId: transaction.sourceId?.toString(),
          amount: transaction.amount,
          reference,
        });
      } catch (refundError) {
        await session.abortTransaction();
        logger.error("Monnify: Refund failed", {
          error: refundError,
          transactionId: transaction._id,
        });
        throw refundError;
      } finally {
        session.endSession();
      }

      // ===
      // STEP 4: Send notification
      // ===
      await this.notificationRepository.create({
        type: "withdrawal_reversed",
        notifiableType: "User",
        notifiableId: transaction.sourceId,
        data: {
          transactionType:
            transaction.type === "bank_transfer"
              ? "Bank Transfer"
              : "Withdrawal",
          amount: transaction.amount,
          reference,
          provider: "Monnify",
          reason: "Disbursement reversed by provider",
          refunded: true,
        },
      });

      logger.info("Monnify: Reversed disbursement processed and refunded", {
        reference,
        amount: transaction.amount,
      });
    } catch (error) {
      logger.error("Monnify: Reversed disbursement processing error", {
        error,
        reference,
      });
      throw error;
    }
  }

  /**
   * Check if transaction has already been processed (idempotency)
   * Checks Transaction model instead of Payment
   */
  private async checkIdempotency(
    providerTransactionId?: string
  ): Promise<boolean> {
    if (!providerTransactionId) return false;

    // Check if Transaction with this providerTransactionId exists
    const existingTransaction = await this.transactionRepository.findOne({
      $or: [
        { providerReference: providerTransactionId },
        { "meta.providerTransactionId": providerTransactionId },
        { "meta.monnifyTransactionReference": providerTransactionId },
      ],
      provider: "monnify",
    });

    return !!existingTransaction;
  }
}
