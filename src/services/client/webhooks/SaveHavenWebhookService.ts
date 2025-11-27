import { Transaction } from "@/models/wallet/Transaction";
import { Wallet } from "@/models/wallet/Wallet";
import { Deposit } from "@/models/banking/Deposit";
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
 * SAVEHAVEN WEBHOOK SERVICE (REFACTORED)
 * Handles business logic for SaveHaven webhook events
 *
 * ✅ NEW ARCHITECTURE:
 * - NO Payment model usage
 * - Transaction is single source of truth
 * - Deposit model for audit trail only
 * - Atomic operations with sessions
 *
 * Responsibilities:
 * 1. Process wallet funding (Inwards transfers)
 * 2. Process withdrawal success/failure (Outwards transfers)
 * 3. Handle unsolicited payments
 * 4. Update Transaction records
 * 5. Credit/debit wallets
 * 6. Send notifications
 */
export class SaveHavenWebhookService {
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
   * Main entry point for processing SaveHaven webhooks
   * Routes to appropriate handler based on transferType
   */
  async processWebhook(webhookData: WebhookProcessResult): Promise<void> {
    const { providerTransactionId, metadata } = webhookData;

    try {
      logger.info("SaveHaven webhook service: Processing started", {
        providerTransactionId,
        transferType: metadata.transferType,
        status: webhookData.status,
      });

      // ===
      // STEP 1: Check Idempotency
      // Prevent duplicate processing
      // ===
      const isDuplicate = await this.checkIdempotency(providerTransactionId);
      if (isDuplicate) {
        logger.info("SaveHaven webhook: Duplicate transaction, skipping", {
          providerTransactionId,
        });
        return;
      }

      // ===
      // STEP 2: Route based on transfer type
      // Inwards = wallet funding, Outwards = withdrawal
      // ===
      if (metadata.transferType === "Inwards") {
        await this.handleWalletFunding(webhookData);
      } else if (metadata.transferType === "Outwards") {
        await this.handleWithdrawal(webhookData);
      } else {
        logger.warn("SaveHaven webhook: Unknown transfer type", {
          transferType: metadata.transferType,
          providerTransactionId,
        });
      }

      logger.info("SaveHaven webhook service: Processing completed", {
        providerTransactionId,
        transferType: metadata.transferType,
      });
    } catch (error) {
      logger.error("SaveHaven webhook service: Processing error", {
        error,
        providerTransactionId,
      });
      throw error;
    }
  }

  /**
   * Handle wallet funding (Inwards transfers)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find user by virtual account
   * 2. Create Deposit record (audit trail)
   * 3. Create Transaction record (user-facing)
   * 4. Credit wallet if successful
   * 5. Send notification
   */
  private async handleWalletFunding(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { providerTransactionId, providerReference, status, metadata } =
      webhookData;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info("SaveHaven: Processing wallet funding", {
        providerTransactionId,
        creditAccountNumber: metadata.creditAccountNumber,
        amount: metadata.amount,
        status,
      });

      // ===
      // STEP 1: Find user by virtual account number
      // ===
      const virtualAccount = await this.virtualAccountRepository.findOne({
        accountNumber: metadata.creditAccountNumber,
        provider: "saveHaven",
        isActive: true,
      });

      if (!virtualAccount) {
        await session.abortTransaction();
        logger.error("SaveHaven: Virtual account not found", {
          accountNumber: metadata.creditAccountNumber,
          providerTransactionId,
        });
        throw new AppError(
          "Virtual account not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      const userId = virtualAccount.userId;

      logger.info("SaveHaven: Found virtual account", {
        virtualAccountId: virtualAccount._id,
        userId,
        accountNumber: metadata.creditAccountNumber,
      });

      // ===
      // STEP 2: Check if deposit already processed (idempotency by providerReference)
      // ===
      const existingTransaction = await Transaction.findOne({
        providerReference: providerReference,
        provider: "saveHaven",
        type: "wallet_funding",
      });

      if (existingTransaction) {
        await session.abortTransaction();
        logger.info("SaveHaven: Deposit already processed", {
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
      const balanceAfter =
        status === "success"
          ? balanceBefore + metadata.netAmount
          : balanceBefore;

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
            provider: "saveHaven",
            amount: metadata.netAmount,
            status: status === "success" ? "success" : "failed",
            meta: {
              webhookData: metadata,
              providerReference: providerReference,
              providerTransactionId: providerTransactionId,
              virtualAccountId: virtualAccount._id,
              fees: metadata.fees,
              vat: metadata.vat,
              stampDuty: metadata.stampDuty,
              grossAmount: metadata.amount,
              netAmount: metadata.netAmount,
              unsolicited: true,
              creditAccountNumber: metadata.creditAccountNumber,
              creditAccountName: metadata.creditAccountName,
              debitAccountNumber: metadata.debitAccountNumber,
              debitAccountName: metadata.debitAccountName,
              responseMessage: metadata.responseMessage,
            },
          },
        ],
        { session }
      );

      logger.info("SaveHaven: Deposit record created", {
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
            providerReference: providerReference,
            idempotencyKey: providerReference, // Use provider reference as idempotency key
            transactableType: "Deposit",
            transactableId: deposit[0]._id,
            amount: metadata.netAmount,
            direction: "CREDIT",
            type: "wallet_funding",
            provider: "saveHaven",
            status: status === "success" ? "success" : "failed",
            purpose: "deposit",
            balanceBefore,
            balanceAfter,
            initiatedBy: userId,
            initiatedByType: "system", // Webhook-initiated
            meta: {
              depositId: deposit[0]._id,
              depositReference: depositReference,
              provider: "saveHaven",
              virtualAccount: {
                accountNumber: metadata.creditAccountNumber,
                accountName: metadata.creditAccountName,
                bankName: virtualAccount.bankName,
              },
              fees: metadata.fees,
              vat: metadata.vat,
              stampDuty: metadata.stampDuty,
              grossAmount: metadata.amount,
              netAmount: metadata.netAmount,
              providerTransactionId: providerTransactionId,
              debitAccountNumber: metadata.debitAccountNumber,
              debitAccountName: metadata.debitAccountName,
              responseMessage: metadata.responseMessage,
            },
          },
        ],
        { session }
      );

      logger.info("SaveHaven: Transaction record created", {
        transactionId: transaction[0]._id,
        reference: transactionReference,
        userId,
      });

      // ===
      // STEP 6: Credit wallet if successful
      // ===
      if (status === "success") {
        await Wallet.findByIdAndUpdate(
          wallet._id,
          { $inc: { balance: metadata.netAmount } },
          { session }
        );

        logger.info("SaveHaven: Wallet credited", {
          userId: userId.toString(),
          amount: metadata.netAmount,
          reference: transactionReference,
        });
      }

      // Commit all changes atomically
      await session.commitTransaction();

      // ===
      // STEP 7: Send notification (outside session)
      // ===
      if (status === "success") {
        await this.notificationRepository.create({
          type: "payment_success",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType: "Wallet Funding",
            amount: metadata.netAmount,
            reference: transactionReference,
            provider: "SaveHaven",
            fees: metadata.fees,
            balance: balanceAfter,
          },
        });

        logger.info("SaveHaven: Wallet funded successfully", {
          userId: userId.toString(),
          amount: metadata.netAmount,
          reference: transactionReference,
          providerTransactionId,
        });
      } else if (status === "reversed") {
        await this.notificationRepository.create({
          type: "payment_reversed",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType: "Wallet Funding",
            amount: metadata.netAmount,
            reference: transactionReference,
            provider: "SaveHaven",
            reason: metadata.responseMessage,
          },
        });

        logger.info("SaveHaven: Payment reversed", {
          reference: transactionReference,
          reason: metadata.responseMessage,
        });
      } else if (status === "failed") {
        await this.notificationRepository.create({
          type: "payment_failed",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType: "Wallet Funding",
            amount: metadata.amount,
            reference: transactionReference,
            provider: "SaveHaven",
            reason: metadata.responseMessage,
          },
        });

        logger.info("SaveHaven: Payment failed", {
          reference: transactionReference,
          reason: metadata.responseMessage,
        });
      }
    } catch (error) {
      await session.abortTransaction();
      logger.error("SaveHaven: Wallet funding error", {
        error,
        providerTransactionId,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Handle withdrawal completion (Outwards transfers)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find Transaction record by reference
   * 2. Update Transaction status
   * 3. Refund wallet if failed/reversed
   * 4. Send notification
   */
  private async handleWithdrawal(
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
      logger.info("SaveHaven: Processing withdrawal webhook", {
        reference,
        providerTransactionId,
        amount: metadata.amount,
        status,
      });

      // ===
      // STEP 1: Find Transaction record by reference
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference: reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "saveHaven",
      });

      if (!transaction) {
        logger.error("SaveHaven: Withdrawal transaction not found", {
          reference,
          providerTransactionId,
        });
        throw new AppError(
          "Withdrawal transaction not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      logger.info("SaveHaven: Found transaction record", {
        transactionId: transaction._id,
        reference,
        userId: transaction.sourceId,
        currentStatus: transaction.status,
      });

      // ===
      // STEP 2: Check if already processed (idempotency)
      // ===
      if (transaction.status === "success" || transaction.status === "failed") {
        logger.info("SaveHaven: Withdrawal already processed", {
          transactionId: transaction._id,
          currentStatus: transaction.status,
          webhookStatus: status,
        });
        return;
      }

      // ===
      // STEP 3: Map status and update Transaction
      // ===
      const transactionStatus = this.mapPaymentStatusToTransaction(status);

      await this.transactionRepository.update(transaction.id.toString(), {
        status: transactionStatus,
        providerReference: providerTransactionId,
        meta: {
          ...transaction.meta,
          providerTransactionId: providerTransactionId,
          webhookData: metadata,
          fees: metadata.fees,
          vat: metadata.vat,
          stampDuty: metadata.stampDuty,
          responseMessage: metadata.responseMessage,
          completedAt: new Date(),
        },
      });

      logger.info("SaveHaven: Transaction updated", {
        transactionId: transaction._id,
        status: transactionStatus,
      });

      // ===
      // STEP 4: Handle refund if failed/reversed
      // ===
      if (status === "failed" || status === "reversed") {
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
          // Credit wallet back
          await Wallet.findByIdAndUpdate(
            transaction.walletId,
            { $inc: { balance: transaction.amount } },
            { session }
          );

          await session.commitTransaction();

          logger.info(`SaveHaven: Wallet refunded for ${status} withdrawal`, {
            userId: transaction.sourceId?.toString(),
            amount: transaction.amount,
            reference,
          });
        } catch (refundError) {
          await session.abortTransaction();
          logger.error("SaveHaven: Refund failed", {
            error: refundError,
            transactionId: transaction._id,
          });
          throw refundError;
        } finally {
          session.endSession();
        }
      }

      // ===
      // STEP 5: Send notification
      // ===
      const userId = transaction.sourceId;
      const amount = transaction.amount;
      const transactionType =
        transaction.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal";

      if (status === "success") {
        await this.notificationRepository.create({
          type: "withdrawal_completed",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType,
            amount,
            reference,
            provider: "SaveHaven",
            accountNumber: transaction.meta?.accountNumber,
            bankName: transaction.meta?.bankName,
          },
        });

        logger.info("SaveHaven: Withdrawal completed successfully", {
          reference,
          amount,
          providerTransactionId,
        });
      } else if (status === "failed" || status === "reversed") {
        await this.notificationRepository.create({
          type:
            status === "reversed" ? "withdrawal_reversed" : "withdrawal_failed",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType,
            amount,
            reference,
            provider: "SaveHaven",
            reason: metadata.responseMessage,
            refunded: true,
          },
        });

        logger.info(`SaveHaven: Withdrawal ${status} and refunded`, {
          reference,
          amount,
          providerTransactionId,
        });
      }
    } catch (error) {
      logger.error("SaveHaven: Withdrawal processing error", {
        error,
        reference,
        providerTransactionId,
      });
      throw error;
    }
  }

  /**
   * Check if transaction has already been processed (idempotency)
   * Now checks Transaction model instead of Payment
   */
  private async checkIdempotency(
    providerTransactionId?: string
  ): Promise<boolean> {
    if (!providerTransactionId) return false;

    // Check if Transaction with this providerTransactionId exists
    const existingTransaction = await this.transactionRepository.findOne({
      "meta.providerTransactionId": providerTransactionId,
      provider: "saveHaven",
    });

    return !!existingTransaction;
  }

  /**
   * Map payment status to transaction status
   */
  private mapPaymentStatusToTransaction(
    paymentStatus: string
  ): "pending" | "processing" | "success" | "failed" | "reversed" {
    const statusMap: Record<string, any> = {
      success: "success",
      failed: "failed",
      reversed: "reversed",
      pending: "processing",
      processing: "processing",
    };

    return statusMap[paymentStatus] || "processing";
  }
}
