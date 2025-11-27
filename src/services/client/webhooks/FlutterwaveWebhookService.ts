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
 * FLUTTERWAVE WEBHOOK SERVICE (REFACTORED)
 * Handles business logic for Flutterwave webhook events
 *
 * ✅ NEW ARCHITECTURE:
 * - NO Payment model usage
 * - Transaction is single source of truth
 * - Deposit model for audit trail only
 * - Atomic operations with sessions
 *
 * Responsibilities:
 * 1. Process wallet funding (charge.completed)
 * 2. Process withdrawal success/failure (transfer.completed)
 * 3. Handle unsolicited payments
 * 4. Update Transaction records
 * 5. Credit/debit wallets
 * 6. Send notifications
 */
export class FlutterwaveWebhookService {
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
   * Main entry point for processing Flutterwave webhooks
   * Routes to appropriate handler based on event type
   */
  async processWebhook(webhookData: WebhookProcessResult): Promise<void> {
    const { providerTransactionId, metadata } = webhookData;

    try {
      logger.info("Flutterwave webhook service: Processing started", {
        providerTransactionId,
        eventType: metadata.eventType,
        status: webhookData.status,
      });

      // ===
      // STEP 1: Check Idempotency
      // Prevent duplicate processing
      // ===
      const isDuplicate = await this.checkIdempotency(providerTransactionId);
      if (isDuplicate) {
        logger.info("Flutterwave webhook: Duplicate transaction, skipping", {
          providerTransactionId,
        });
        return;
      }

      // ===
      // STEP 2: Route based on event type
      // ===
      switch (metadata.eventType) {
        case "charge.completed":
          await this.handleChargeEvent(webhookData);
          break;

        case "transfer.completed":
          await this.handleTransferEvent(webhookData);
          break;

        default:
          logger.warn(`Unsupported Flutterwave event: ${metadata.eventType}`);
      }

      logger.info("Flutterwave webhook service: Processing completed", {
        providerTransactionId,
        eventType: metadata.eventType,
      });
    } catch (error) {
      logger.error("Flutterwave webhook service: Processing error", {
        error,
        providerTransactionId,
      });
      throw error;
    }
  }

  /**
   * Handle charge.completed events
   * Routes to success/failure handlers based on status
   */
  private async handleChargeEvent(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    switch (webhookData.status) {
      case "success":
        await this.handleSuccessfulCharge(webhookData);
        break;

      case "failed":
        await this.handleFailedCharge(webhookData);
        break;

      case "pending":
        logger.info("Flutterwave charge pending, waiting for completion", {
          reference: webhookData.reference,
        });
        break;

      default:
        logger.warn("Unexpected charge status", {
          status: webhookData.status,
          reference: webhookData.reference,
        });
    }
  }

  /**
   * Handle transfer.completed events
   * Routes to success/failure handlers based on status
   */
  private async handleTransferEvent(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    switch (webhookData.status) {
      case "success":
        await this.handleSuccessfulTransfer(webhookData);
        break;

      case "failed":
        await this.handleFailedTransfer(webhookData);
        break;

      case "reversed":
        await this.handleReversedTransfer(webhookData);
        break;

      case "pending":
        logger.info("Flutterwave transfer pending, waiting for completion", {
          reference: webhookData.reference,
        });
        break;

      default:
        logger.warn("Unexpected transfer status", {
          status: webhookData.status,
          reference: webhookData.reference,
        });
    }
  }

  /**
   * Handle successful charge (wallet funding)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find user by virtual account
   * 2. Create Deposit record (audit trail)
   * 3. Create Transaction record (user-facing)
   * 4. Credit wallet if successful
   * 5. Send notification
   */
  private async handleSuccessfulCharge(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { providerTransactionId, providerReference, status, metadata } =
      webhookData;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      logger.info("Flutterwave: Processing wallet funding", {
        providerTransactionId,
        txRef: metadata.txRef,
        accountNumber: metadata.accountNumber,
        amount: metadata.amount,
        status,
      });

      // ===
      // STEP 1: Find user by virtual account number
      // ===
      const virtualAccount = await this.virtualAccountRepository.findOne({
        accountNumber: metadata.accountNumber,
        provider: "flutterwave",
        isActive: true,
      });

      if (!virtualAccount) {
        await session.abortTransaction();
        logger.error("Flutterwave: Virtual account not found", {
          accountNumber: metadata.accountNumber,
          providerTransactionId,
        });
        throw new AppError(
          "Virtual account not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      const userId = virtualAccount.userId;

      logger.info("Flutterwave: Found virtual account", {
        virtualAccountId: virtualAccount._id,
        userId,
        accountNumber: metadata.accountNumber,
      });

      // ===
      // STEP 2: Check if deposit already processed (idempotency)
      // ===
      const existingTransaction = await Transaction.findOne({
        $or: [
          { providerReference: providerReference },
          { providerReference: metadata.flwRef },
          { "meta.txRef": metadata.txRef },
          { "meta.flutterwaveId": metadata.flutterwaveId },
        ],
        provider: "flutterwave",
        type: "wallet_funding",
      });

      if (existingTransaction) {
        await session.abortTransaction();
        logger.info("Flutterwave: Deposit already processed", {
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
      const amountToCredit = metadata.netAmount || metadata.amount || 0;
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
            provider: "flutterwave",
            amount: amountToCredit,
            status: "success",
            meta: {
              webhookData: metadata,
              providerReference: providerReference,
              providerTransactionId: providerTransactionId,
              virtualAccountId: virtualAccount._id,
              flutterwaveId: metadata.flutterwaveId,
              txRef: metadata.txRef,
              flwRef: metadata.flwRef,
              fees: metadata.fees,
              grossAmount: metadata.amount,
              netAmount: metadata.netAmount,
              currency: metadata.currency,
              paymentMethod: metadata.paymentMethod,
              customerEmail: metadata.customerEmail,
              unsolicited: true, // Webhook-based deposits are unsolicited
            },
          },
        ],
        { session }
      );

      logger.info("Flutterwave: Deposit record created", {
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
            providerReference: metadata.flwRef || providerReference,
            idempotencyKey: metadata.txRef || providerReference,
            transactableType: "Deposit",
            transactableId: deposit[0]._id,
            amount: amountToCredit,
            direction: "CREDIT",
            type: "wallet_funding",
            provider: "flutterwave",
            status: "success",
            purpose: "Wallet funding via Flutterwave",
            balanceBefore,
            balanceAfter,
            initiatedBy: userId,
            initiatedByType: "system", // Webhook-initiated
            meta: {
              depositId: deposit[0]._id,
              depositReference: depositReference,
              provider: "flutterwave",
              virtualAccount: {
                accountNumber: metadata.accountNumber,
                accountName: virtualAccount.accountName,
                bankName: virtualAccount.bankName,
              },
              flutterwaveId: metadata.flutterwaveId,
              txRef: metadata.txRef,
              flwRef: metadata.flwRef,
              fees: metadata.fees,
              grossAmount: metadata.amount,
              netAmount: metadata.netAmount,
              currency: metadata.currency,
              paymentMethod: metadata.paymentMethod,
              customerEmail: metadata.customerEmail,
              providerTransactionId: providerTransactionId,
            },
          },
        ],
        { session }
      );

      logger.info("Flutterwave: Transaction record created", {
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

      logger.info("Flutterwave: Wallet credited", {
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
          reference: transactionReference,
          provider: "Flutterwave",
          paymentMethod: metadata.paymentMethod,
          fees: metadata.fees,
          balance: balanceAfter,
        },
      });

      logger.info("Flutterwave: Wallet funded successfully", {
        userId: userId.toString(),
        amount: amountToCredit,
        reference: transactionReference,
        providerTransactionId,
      });
    } catch (error) {
      await session.abortTransaction();
      logger.error("Flutterwave: Wallet funding error", {
        error,
        providerTransactionId,
      });
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Handle failed charge
   * Create failed Transaction record for audit
   */
  private async handleFailedCharge(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { providerTransactionId, providerReference, metadata } = webhookData;

    try {
      logger.info("Flutterwave: Processing failed charge", {
        providerTransactionId,
        txRef: metadata.txRef,
        amount: metadata.amount,
      });

      // Find virtual account to get userId
      const virtualAccount = await this.virtualAccountRepository.findOne({
        accountNumber: metadata.accountNumber,
        provider: "flutterwave",
        isActive: true,
      });

      if (!virtualAccount) {
        logger.warn("Flutterwave: Virtual account not found for failed charge", {
          accountNumber: metadata.accountNumber,
        });
        return;
      }

      const userId = virtualAccount.userId;

      // Check if already processed
      const existingTransaction = await Transaction.findOne({
        $or: [
          { providerReference: providerReference },
          { "meta.txRef": metadata.txRef },
        ],
        provider: "flutterwave",
        type: "wallet_funding",
        status: "failed",
      });

      if (existingTransaction) {
        logger.info("Flutterwave: Failed charge already recorded", {
          transactionId: existingTransaction._id,
        });
        return;
      }

      // Get wallet for balance tracking
      const wallet = await this.walletRepository.findByUserId(userId);
      if (!wallet) {
        logger.warn("Flutterwave: Wallet not found for failed charge", {
          userId,
        });
        return;
      }

      // Create failed Deposit record
      const depositReference = generateReference("DEP");
      const deposit = await Deposit.create({
        userId: userId,
        walletId: wallet._id,
        reference: depositReference,
        provider: "flutterwave",
        amount: metadata.amount || 0,
        status: "failed",
        meta: {
          webhookData: metadata,
          providerReference: providerReference,
          providerTransactionId: providerTransactionId,
          failureReason: metadata.failureReason || "Payment failed",
        },
      });

      // Create failed Transaction record
      const transactionReference = generateReference("TXN");
      await Transaction.create({
        walletId: wallet._id,
        sourceId: userId,
        reference: transactionReference,
        providerReference: metadata.flwRef || providerReference,
        idempotencyKey: metadata.txRef || providerReference,
        transactableType: "Deposit",
        transactableId: deposit._id,
        amount: metadata.amount || 0,
        direction: "CREDIT",
        type: "wallet_funding",
        provider: "flutterwave",
        status: "failed",
        balanceBefore: wallet.balance,
        balanceAfter: wallet.balance, // No change
        initiatedBy: userId,
        initiatedByType: "system",
        meta: {
          depositId: deposit._id,
          depositReference: depositReference,
          failureReason: metadata.failureReason || "Payment failed",
          txRef: metadata.txRef,
          flwRef: metadata.flwRef,
        },
      });

      // Send notification
      await this.notificationRepository.create({
        type: "payment_failed",
        notifiableType: "User",
        notifiableId: userId,
        data: {
          transactionType: "Wallet Funding",
          amount: metadata.amount,
          reference: transactionReference,
          provider: "Flutterwave",
          reason: metadata.failureReason || "Payment failed",
        },
      });

      logger.info("Flutterwave: Failed charge processed", {
        reference: transactionReference,
        reason: metadata.failureReason,
      });
    } catch (error) {
      logger.error("Flutterwave: Failed charge processing error", {
        error,
        providerTransactionId,
      });
      throw error;
    }
  }

  /**
   * Handle successful transfer (withdrawal completion)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find Transaction record by reference
   * 2. Update Transaction status
   * 3. Send notification
   */
  private async handleSuccessfulTransfer(
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
      logger.info("Flutterwave: Processing withdrawal webhook", {
        reference,
        providerTransactionId,
        transferId: metadata.transferId,
        amount: metadata.amount,
        status,
      });

      // ===
      // STEP 1: Find Transaction record by reference
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference: reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "flutterwave",
      });

      if (!transaction) {
        logger.error("Flutterwave: Withdrawal transaction not found", {
          reference,
          providerTransactionId,
        });
        throw new AppError(
          "Withdrawal transaction not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      logger.info("Flutterwave: Found transaction record", {
        transactionId: transaction._id,
        reference,
        userId: transaction.sourceId,
        currentStatus: transaction.status,
      });

      // ===
      // STEP 2: Check if already processed (idempotency)
      // ===
      if (
        transaction.status === "success" ||
        transaction.status === "failed"
      ) {
        logger.info("Flutterwave: Withdrawal already processed", {
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
        providerReference: metadata.transferId || providerTransactionId,
        meta: {
          ...transaction.meta,
          transferId: metadata.transferId,
          flutterwaveId: metadata.flutterwaveId,
          providerTransactionId: providerTransactionId,
          webhookData: metadata,
          completedAt: new Date(),
        },
      });

      logger.info("Flutterwave: Transaction updated to success", {
        transactionId: transaction._id,
        transferId: metadata.transferId,
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
          reference,
          provider: "Flutterwave",
          accountNumber: transaction.meta?.accountNumber,
          bankName: transaction.meta?.bankName,
        },
      });

      logger.info("Flutterwave: Withdrawal completed successfully", {
        reference,
        amount,
        transferId: metadata.transferId,
      });
    } catch (error) {
      logger.error("Flutterwave: Withdrawal processing error", {
        error,
        reference,
        providerTransactionId,
      });
      throw error;
    }
  }

  /**
   * Handle failed transfer (withdrawal failure)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find Transaction record by reference
   * 2. Update Transaction status to failed
   * 3. Refund wallet
   * 4. Send notification
   */
  private async handleFailedTransfer(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerTransactionId, metadata } = webhookData;

    try {
      logger.info("Flutterwave: Processing failed transfer", {
        reference,
        providerTransactionId,
        failureReason: metadata.failureReason,
      });

      // ===
      // STEP 1: Find Transaction record
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference: reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "flutterwave",
      });

      if (!transaction) {
        logger.error("Flutterwave: Transaction not found for failed transfer", {
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
        logger.info("Flutterwave: Transaction already marked as failed", {
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
          error: metadata.failureReason || "Transfer failed",
          providerTransactionId: providerTransactionId,
          webhookData: metadata,
          failedAt: new Date(),
        },
      });

      logger.info("Flutterwave: Transaction marked as failed", {
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

        logger.info("Flutterwave: Wallet refunded for failed withdrawal", {
          userId: transaction.sourceId?.toString(),
          amount: transaction.amount,
          reference,
        });
      } catch (refundError) {
        await session.abortTransaction();
        logger.error("Flutterwave: Refund failed", {
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
          provider: "Flutterwave",
          reason: metadata.failureReason || "Transfer failed",
          refunded: true,
        },
      });

      logger.info("Flutterwave: Failed transfer processed and refunded", {
        reference,
        amount: transaction.amount,
      });
    } catch (error) {
      logger.error("Flutterwave: Failed transfer processing error", {
        error,
        reference,
      });
      throw error;
    }
  }

  /**
   * Handle reversed transfer (withdrawal reversal)
   *
   * ✅ NEW FLOW (No Payment Model):
   * 1. Find Transaction record by reference
   * 2. Update Transaction status to reversed
   * 3. Refund wallet
   * 4. Send notification
   */
  private async handleReversedTransfer(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerTransactionId, metadata } = webhookData;

    try {
      logger.info("Flutterwave: Processing reversed transfer", {
        reference,
        providerTransactionId,
        reversalReason: metadata.failureReason,
      });

      // ===
      // STEP 1: Find Transaction record
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference: reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "flutterwave",
      });

      if (!transaction) {
        logger.error(
          "Flutterwave: Transaction not found for reversed transfer",
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
        logger.info("Flutterwave: Transaction already marked as reversed", {
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
          reversedAt: new Date(),
          reversalReason: metadata.failureReason || "Transfer reversed",
          providerTransactionId: providerTransactionId,
          webhookData: metadata,
        },
      });

      logger.info("Flutterwave: Transaction marked as reversed", {
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

        logger.info("Flutterwave: Wallet refunded for reversed withdrawal", {
          userId: transaction.sourceId?.toString(),
          amount: transaction.amount,
          reference,
        });
      } catch (refundError) {
        await session.abortTransaction();
        logger.error("Flutterwave: Refund failed", {
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
          provider: "Flutterwave",
          reason: metadata.failureReason || "Transfer reversed",
          refunded: true,
        },
      });

      logger.info("Flutterwave: Reversed transfer processed and refunded", {
        reference,
        amount: transaction.amount,
      });
    } catch (error) {
      logger.error("Flutterwave: Reversed transfer processing error", {
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
        { "meta.flutterwaveId": providerTransactionId },
      ],
      provider: "flutterwave",
    });

    return !!existingTransaction;
  }
}