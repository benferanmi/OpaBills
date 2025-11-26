import { Payment } from "@/models/wallet/Payment";
import { Transaction } from "@/models/wallet/Transaction";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import logger from "@/logger";
import { Types } from "mongoose";
import { WebhookProcessResult } from "./FlutterwaveWebhookProcessor";
import { generateReference } from "@/utils/helpers";
import { VirtualAccount } from "@/models/banking/VirtualAccount";
import { WalletService } from "../WalletService";

/**
 * FLUTTERWAVE WEBHOOK SERVICE
 * 
 * Purpose: Handle business logic for Flutterwave webhook events
 * Responsibilities:
 * - Find or create Payment/Transaction records
 * - Check idempotency (prevent duplicate processing)
 * - Update database records
 * - Credit/debit wallets
 * - Send notifications
 * - Handle unsolicited payments
 * 
 * Event Handlers:
 * - handleSuccessfulCharge (wallet funding)
 * - handleFailedCharge (failed payment)
 * - handleSuccessfulTransfer (withdrawal success)
 * - handleFailedTransfer (withdrawal failure)
 * - handleReversedTransfer (withdrawal reversal)
 */

export class FlutterwaveWebhookService {
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.transactionRepository = new TransactionRepository();
  }

  /**
   * Main entry point for webhook processing
   * Routes to appropriate handler based on event type and status
   * 
   * @param webhookData - Processed webhook data from FlutterwaveWebhookProcessor
   */
  async processWebhook(webhookData: WebhookProcessResult): Promise<void> {
    try {
      const { metadata } = webhookData;

      logger.info("Flutterwave webhook service processing", {
        eventType: metadata.eventType,
        reference: webhookData.reference,
        status: webhookData.status,
      });

      // Route based on event type
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
    } catch (error: any) {
      logger.error("Error processing Flutterwave webhook", {
        error: error.message,
        stack: error.stack,
        webhookData,
      });
      throw error;
    }
  }

  /**
   * Handle charge.completed events
   * Routes to success/failure handlers based on status
   */
  private async handleChargeEvent(webhookData: WebhookProcessResult): Promise<void> {
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
  private async handleTransferEvent(webhookData: WebhookProcessResult): Promise<void> {
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
   * Supports both solicited and unsolicited payments
   */
  private async handleSuccessfulCharge(webhookData: WebhookProcessResult): Promise<void> {
    const { reference, providerTransactionId, metadata } = webhookData;

    try {
      // ===
      // STEP 1: Check Idempotency
      // Prevent duplicate processing by checking providerTransactionId
      // ===
      const existingPayment = await Payment.findOne({
        providerTransactionId,
        "meta.provider": "flutterwave",
      });

      if (existingPayment && existingPayment.status === "success") {
        logger.info("Flutterwave charge already processed, skipping", {
          reference,
          providerTransactionId,
        });
        return;
      }

      // ===
      // STEP 2: Find or Create Payment Record
      // Try to find by reference first (solicited payment)
      // If not found, check if it's an unsolicited payment via virtual account
      // ===
      let payment = await Payment.findOne({
        reference,
        type: "deposit",
        "meta.provider": "flutterwave",
      });

      if (!payment) {
        // Unsolicited payment - find by virtual account
        logger.info("Payment not found by reference, checking for unsolicited payment", {
          reference,
          accountNumber: metadata.accountNumber,
        });

        payment = await this.handleUnsolicitedPayment(webhookData);
      }

      if (!payment) {
        logger.error("Cannot process payment: No matching record or virtual account found", {
          reference,
          accountNumber: metadata.accountNumber,
        });
        return;
      }

      // ===
      // STEP 3: Update Payment Record
      // ===
      payment.status = "success";
      payment.amountPaid = metadata.netAmount || metadata.amount || 0;
      payment.providerReference = webhookData.providerReference;
      payment.providerTransactionId = providerTransactionId;

      // Update metadata
      payment.meta = {
        ...payment.meta,
        flutterwaveId: metadata.flutterwaveId,
        txRef: metadata.txRef,
        flwRef: metadata.flwRef,
        amount: metadata.amount,
        fees: metadata.fees,
        netAmount: metadata.netAmount,
        currency: metadata.currency,
        paymentMethod: metadata.paymentMethod,
        customerEmail: metadata.customerEmail,
        processedAt: new Date(),
      };

      await payment.save();

      logger.info("Flutterwave payment updated to success", {
        reference,
        amount: payment.amountPaid,
        userId: payment.userId,
      });

      // ===
      // STEP 4: Credit User Wallet
      // Use netAmount (after fees)
      // ===
      const amountToCredit = metadata.netAmount || metadata.amount || 0;

      await this.walletService.creditWallet(
        payment.userId,
        amountToCredit,
        `Wallet funding via Flutterwave - ${reference}`,
        "main"
      );

      logger.info("User wallet credited", {
        userId: payment.userId,
        amount: amountToCredit,
        reference,
      });

      // ===
      // STEP 5: Send Notification
      // ===
      const notificationType = payment.meta.unsolicited 
        ? "unsolicited_payment" 
        : "payment_success";

      await this.notificationRepository.create({
        type: notificationType,
        notifiableType: "User",
        notifiableId: payment.userId,
        data: {
          transactionType: "Wallet Funding",
          amount: amountToCredit,
          reference: payment.reference,
          provider: "flutterwave",
          paymentMethod: metadata.paymentMethod,
          fees: metadata.fees,
        },
      });

      logger.info("Flutterwave charge processed successfully", {
        reference,
        userId: payment.userId,
        amount: amountToCredit,
      });
    } catch (error: any) {
      logger.error("Error handling Flutterwave successful charge", {
        error: error.message,
        stack: error.stack,
        reference,
      });
      throw error;
    }
  }

  /**
   * Handle unsolicited payment
   * User sent money without initiating in app
   */
  private async handleUnsolicitedPayment(
    webhookData: WebhookProcessResult
  ): Promise<any> {
    const { metadata } = webhookData;

    // Find virtual account by account number
    const virtualAccount = await VirtualAccount.findOne({
      accountNumber: metadata.accountNumber,
      provider: "flutterwave",
      isActive: true,
    });

    if (!virtualAccount) {
      logger.warn("Virtual account not found for unsolicited payment", {
        accountNumber: metadata.accountNumber,
      });
      return null;
    }

    logger.info("Processing unsolicited Flutterwave payment", {
      userId: virtualAccount.userId,
      accountNumber: metadata.accountNumber,
      amount: metadata.amount,
    });

    // Create new payment record
    const payment = await Payment.create({
      userId: virtualAccount.userId,
      reference: generateReference("DEP"),
      amount: metadata.amount || 0,
      amountPaid: metadata.netAmount || metadata.amount || 0,
      type: "deposit",
      status: "pending", // Will be updated to success by caller
      providerReference: webhookData.providerReference,
      providerTransactionId: webhookData.providerTransactionId,
      meta: {
        provider: "flutterwave",
        unsolicited: true,
        virtualAccount: {
          accountNumber: virtualAccount.accountNumber,
          accountName: virtualAccount.accountName,
          bankName: virtualAccount.bankName,
          orderReference: virtualAccount.orderReference,
        },
        flutterwaveId: metadata.flutterwaveId,
        txRef: metadata.txRef,
        flwRef: metadata.flwRef,
        paymentMethod: metadata.paymentMethod,
        customerEmail: metadata.customerEmail,
      },
    });

    logger.info("Unsolicited payment record created", {
      reference: payment.reference,
      userId: virtualAccount.userId,
    });

    return payment;
  }

  /**
   * Handle failed charge
   * Log and notify user about failed payment
   */
  private async handleFailedCharge(webhookData: WebhookProcessResult): Promise<void> {
    const { reference, metadata } = webhookData;

    try {
      // Find payment record
      const payment = await Payment.findOne({
        reference,
        type: "deposit",
        "meta.provider": "flutterwave",
      });

      if (!payment) {
        logger.warn("Payment not found for failed charge", { reference });
        return;
      }

      // Check idempotency
      if (payment.status === "failed") {
        logger.info("Payment already marked as failed", { reference });
        return;
      }

      // Update payment status
      payment.status = "failed";
      payment.meta = {
        ...payment.meta,
        error: metadata.failureReason || "Payment failed",
        failedAt: new Date(),
      };

      await payment.save();

      logger.info("Flutterwave payment marked as failed", {
        reference,
        reason: metadata.failureReason,
      });

      // Send failure notification
      await this.notificationRepository.create({
        type: "payment_failed",
        notifiableType: "User",
        notifiableId: payment.userId,
        data: {
          transactionType: "Wallet Funding",
          amount: metadata.amount,
          reference: payment.reference,
          provider: "flutterwave",
          reason: metadata.failureReason || "Payment failed",
        },
      });
    } catch (error: any) {
      logger.error("Error handling Flutterwave failed charge", {
        error: error.message,
        reference,
      });
      throw error;
    }
  }

  /**
   * Handle successful transfer (withdrawal)
   * Update payment and withdrawal transaction records
   */
  private async handleSuccessfulTransfer(webhookData: WebhookProcessResult): Promise<void> {
    const { reference, providerTransactionId, metadata } = webhookData;

    try {
      // ===
      // STEP 1: Check Idempotency
      // ===
      const existingPayment = await Payment.findOne({
        providerTransactionId,
        "meta.provider": "flutterwave",
        type: "withdrawal",
      });

      if (existingPayment && existingPayment.status === "success") {
        logger.info("Flutterwave transfer already processed, skipping", {
          reference,
          providerTransactionId,
        });
        return;
      }

      // ===
      // STEP 2: Find Payment Record
      // ===
      const payment = await Payment.findOne({
        reference,
        type: "withdrawal",
        "meta.provider": "flutterwave",
      });

      if (!payment) {
        logger.error("Payment not found for successful transfer", { reference });
        return;
      }

      // ===
      // STEP 3: Find Transaction Record
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "flutterwave",
      });

      if (!transaction) {
        logger.warn("Withdrawal Transaction not found for successful transfer", { reference });
      } else {
        logger.info("Found Withdrawal Transaction record", {
          transactionId: transaction._id,
          reference,
        });
      }

      // ===
      // STEP 4: Update Payment Record
      // ===
      payment.status = "success";
      payment.providerTransactionId = providerTransactionId;
      payment.meta = {
        ...payment.meta,
        flutterwaveId: metadata.flutterwaveId,
        transferId: metadata.transferId,
        completedAt: new Date(),
      };

      await payment.save();

      logger.info("Flutterwave payment updated to success", {
        paymentId: payment._id,
        reference,
      });

      // ===
      // STEP 5: Update Transaction Record
      // ===
      if (transaction) {
        await this.transactionRepository.update(transaction.id.toString(), {
          status: "success",
          providerReference: metadata.transferId,
          meta: {
            ...transaction.meta,
            paymentReference: payment.reference,
            transferId: metadata.transferId,
            completedAt: new Date(),
          },
        });

        logger.info("Withdrawal Transaction updated to success", {
          transactionId: transaction._id,
          reference,
        });
      }

      // ===
      // STEP 6: Send Success Notification
      // ===
      const userId = transaction?.sourceId || payment.userId;
      
      await this.notificationRepository.create({
        type: "withdrawal_completed",
        notifiableType: "User",
        notifiableId: userId,
        data: {
          transactionType: transaction?.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal",
          amount: transaction?.amount || payment.amount,
          reference: reference,
          provider: "flutterwave",
        },
      });

      logger.info("Flutterwave transfer processed successfully", {
        reference,
        userId,
      });
    } catch (error: any) {
      logger.error("Error handling Flutterwave successful transfer", {
        error: error.message,
        stack: error.stack,
        reference,
      });
      throw error;
    }
  }

  /**
   * Handle failed transfer (withdrawal)
   * Refund wallet and notify user
   */
  private async handleFailedTransfer(webhookData: WebhookProcessResult): Promise<void> {
    const { reference, metadata } = webhookData;

    try {
      // ===
      // STEP 1: Find Payment Record
      // ===
      const payment = await Payment.findOne({
        reference,
        type: "withdrawal",
        "meta.provider": "flutterwave",
      });

      if (!payment) {
        logger.error("Payment not found for failed transfer", { reference });
        return;
      }

      // Check idempotency
      if (payment.status === "failed") {
        logger.info("Payment already marked as failed", { reference });
        return;
      }

      // ===
      // STEP 2: Find Transaction Record
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "flutterwave",
      });

      if (!transaction) {
        logger.warn("Withdrawal Transaction not found for failed transfer", { reference });
      } else {
        logger.info("Found Withdrawal Transaction record", {
          transactionId: transaction._id,
          reference,
        });
      }

      // ===
      // STEP 3: Update Payment Record
      // ===
      payment.status = "failed";
      payment.meta = {
        ...payment.meta,
        error: metadata.failureReason || "Transfer failed",
        failedAt: new Date(),
      };

      await payment.save();

      logger.info("Flutterwave payment marked as failed", {
        paymentId: payment._id,
        reference,
      });

      // ===
      // STEP 4: Update Transaction Record
      // ===
      if (transaction) {
        await this.transactionRepository.update(transaction.id.toString(), {
          status: "failed",
          meta: {
            ...transaction.meta,
            error: metadata.failureReason || "Transfer failed",
            failedAt: new Date(),
          },
        });

        logger.info("Withdrawal Transaction marked as failed", {
          transactionId: transaction._id,
          reference,
        });
      }

      // ===
      // STEP 5: REFUND WALLET
      // CRITICAL: Return money to user's wallet
      // ===
      const userId = transaction?.sourceId || payment.userId;
      const amount = transaction?.amount || payment.amount;

      await this.walletService.creditWallet(
        userId,
        amount,
        `Withdrawal refund - ${reference} (Flutterwave transfer failed)`,
        "main"
      );

      logger.info("Wallet refunded for failed withdrawal", {
        userId,
        amount,
        reference,
      });

      // ===
      // STEP 6: Send Failure Notification
      // ===
      await this.notificationRepository.create({
        type: "withdrawal_failed",
        notifiableType: "User",
        notifiableId: userId,
        data: {
          transactionType: transaction?.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal",
          amount: amount,
          reference: reference,
          provider: "flutterwave",
          reason: metadata.failureReason || "Transfer failed",
          refunded: true,
        },
      });

      logger.info("Flutterwave failed transfer processed", {
        reference,
        userId,
        refunded: true,
      });
    } catch (error: any) {
      logger.error("Error handling Flutterwave failed transfer", {
        error: error.message,
        stack: error.stack,
        reference,
      });
      throw error;
    }
  }

  /**
   * Handle reversed transfer (withdrawal)
   * Similar to failed transfer - refund wallet
   */
  private async handleReversedTransfer(webhookData: WebhookProcessResult): Promise<void> {
    const { reference, metadata } = webhookData;

    try {
      // ===
      // STEP 1: Find Payment Record
      // ===
      const payment = await Payment.findOne({
        reference,
        type: "withdrawal",
        "meta.provider": "flutterwave",
      });

      if (!payment) {
        logger.error("Payment not found for reversed transfer", { reference });
        return;
      }

      // Check idempotency
      if (payment.status === "reversed") {
        logger.info("Payment already marked as reversed", { reference });
        return;
      }

      // ===
      // STEP 2: Find Transaction Record
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
        provider: "flutterwave",
      });

      if (!transaction) {
        logger.warn("Withdrawal Transaction not found for reversed transfer", { reference });
      } else {
        logger.info("Found Withdrawal Transaction record", {
          transactionId: transaction._id,
          reference,
        });
      }

      // ===
      // STEP 3: Update Payment Record
      // ===
      payment.status = "reversed";
      payment.meta = {
        ...payment.meta,
        reversedAt: new Date(),
        reversalReason: metadata.failureReason || "Transfer reversed",
      };

      await payment.save();

      logger.info("Flutterwave payment marked as reversed", {
        paymentId: payment._id,
        reference,
      });

      // ===
      // STEP 4: Update Transaction Record
      // ===
      if (transaction) {
        await this.transactionRepository.update(transaction.id.toString(), {
          status: "reversed",
          meta: {
            ...transaction.meta,
            reversedAt: new Date(),
            reversalReason: metadata.failureReason || "Transfer reversed",
          },
        });

        logger.info("Withdrawal Transaction marked as reversed", {
          transactionId: transaction._id,
          reference,
        });
      }

      // ===
      // STEP 5: REFUND WALLET (if not already refunded)
      // ===
      const userId = transaction?.sourceId || payment.userId;
      const amount = transaction?.amount || payment.amount;

      await this.walletService.creditWallet(
        userId,
        amount,
        `Withdrawal reversal - ${reference} (Flutterwave transfer reversed)`,
        "main"
      );

      logger.info("Wallet refunded for reversed withdrawal", {
        userId,
        amount,
        reference,
      });

      // ===
      // STEP 6: Send Reversal Notification
      // ===
      await this.notificationRepository.create({
        type: "withdrawal_reversed",
        notifiableType: "User",
        notifiableId: userId,
        data: {
          transactionType: transaction?.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal",
          amount: amount,
          reference: reference,
          provider: "flutterwave",
          reason: metadata.failureReason || "Transfer reversed",
          refunded: true,
        },
      });

      logger.info("Flutterwave reversed transfer processed", {
        reference,
        userId,
        refunded: true,
      });
    } catch (error: any) {
      logger.error("Error handling Flutterwave reversed transfer", {
        error: error.message,
        stack: error.stack,
        reference,
      });
      throw error;
    }
  }
}