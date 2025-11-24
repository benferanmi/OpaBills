import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./client/WalletService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { Types } from "mongoose";

export interface WebhookProcessResult {
  reference: string;
  providerReference: string;
  status: "success" | "pending" | "failed" | "reversed";
  metadata?: any;
  token?: string; // For electricity tokens, e-pins, etc.
  providerTransactionId?: string;
}

/**
 * UNIFIED WEBHOOK SERVICE
 * Handles common webhook logic for ALL providers:
 * - Transaction lookup
 * - Status updates
 * - Wallet refunds
 * - User notifications
 * - Idempotency checks
 */
export class WebhookService {
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
  }

  // Main webhook processing method
  // Called by all provider processors after they parse the payload
  async processWebhook(
    providerName: string,
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerReference, status, metadata, token } =
      webhookData;

    try {
      logger.info(`${providerName} webhook processing started`, {
        reference,
        providerReference,
        status,
      });

      // 1. Find the transaction
      const transaction = await this.findTransaction(reference);

      // 2. Check idempotency (prevent duplicate processing)
      if (this.isAlreadyProcessed(transaction, status)) {
        logger.info(`${providerName} webhook already processed, skipping`, {
          reference,
          currentStatus: transaction.status,
          webhookStatus: status,
        });
        return;
      }

      // 3. Process based on status
      switch (status) {
        case "success":
          await this.handleSuccessfulTransaction(
            transaction,
            providerReference,
            metadata,
            token,
            providerName
          );
          break;

        case "reversed":
          await this.handleReversedTransaction(
            transaction,
            providerReference,
            metadata,
            providerName
          );
          break;

        case "failed":
          await this.handleFailedTransaction(
            transaction,
            providerReference,
            metadata,
            providerName
          );
          break;

        case "pending":
          await this.handlePendingTransaction(
            transaction,
            providerReference,
            metadata,
            providerName
          );
          break;

        default:
          logger.warn(`${providerName} unknown status received`, {
            reference,
            status,
          });
      }

      logger.info(`${providerName} webhook processed successfully`, {
        reference,
        status,
      });
    } catch (error) {
      logger.error(`${providerName} webhook processing error`, {
        reference,
        error,
      });
      throw error;
    }
  }

  //  Find transaction by reference
  private async findTransaction(reference: string): Promise<any> {
    const transaction = await this.transactionRepository.findByReference(
      reference
    );

    if (!transaction) {
      logger.error("Transaction not found for webhook", { reference });
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    return transaction;
  }

  //  Check if transaction has already been processed (idempotency)
  private isAlreadyProcessed(transaction: any, newStatus: string): boolean {
    const finalStatuses = ["success", "reversed"];
    const isFinal = finalStatuses.includes(transaction.status);

    // If already in a final state, don't reprocess
    if (isFinal) {
      return true;
    }

    // If current status is same as new status, already processed
    if (transaction.status === newStatus) {
      return true;
    }

    return false;
  }

  //  Handle successful transaction
  private async handleSuccessfulTransaction(
    transaction: any,
    providerReference: string,
    metadata: any,
    token: string | undefined,
    providerName: string
  ): Promise<void> {
    logger.info("Processing successful transaction", {
      reference: transaction.reference,
      providerReference,
    });

    // Update transaction
    await this.transactionRepository.update(transaction.id, {
      status: "success",
      providerReference,
      meta: {
        ...transaction.meta,
        webhookData: {
          ...metadata,
          processedAt: new Date(),
          provider: providerName,
        },
        token, // Store token if available (electricity, e-pins)
      },
    });

    await this.sendNotification(transaction.sourceId, "transaction_success", {
      transactionType: this.getTransactionTypeLabel(transaction.type),
      amount: transaction.amount,
      reference: transaction.reference,
      token: token || null,
      ...metadata,
    });

    logger.info("Transaction marked as successful", {
      reference: transaction.reference,
      providerReference,
    });
  }

  //  Handle reversed transaction (requires refund)
  private async handleReversedTransaction(
    transaction: any,
    providerReference: string,
    metadata: any,
    providerName: string
  ): Promise<void> {
    logger.info("Processing reversed transaction", {
      reference: transaction.reference,
      providerReference,
      amount: transaction.amount,
    });

    // Update transaction
    await this.transactionRepository.update(transaction.id, {
      status: "reversed",
      providerReference,
      meta: {
        ...transaction.meta,
        webhookData: {
          ...metadata,
          reversedAt: new Date(),
          provider: providerName,
        },
      },
    });

    // Refund wallet
    await this.refundWallet(
      transaction.sourceId.toString(),
      transaction.amount,
      `Transaction reversed - ${transaction.reference}`,
      transaction.reference
    );

    // Send reversal notification
    await this.sendNotification(transaction.sourceId, "transaction_reversed", {
      transactionType: this.getTransactionTypeLabel(transaction.type),
      amount: transaction.amount,
      reference: transaction.reference,
      reason: metadata?.reason || "Transaction reversed by provider",
    });

    logger.info("Transaction reversed and refunded", {
      reference: transaction.reference,
      providerReference,
      refundedAmount: transaction.amount,
    });
  }

  //  Handle failed transaction (requires refund)
  private async handleFailedTransaction(
    transaction: any,
    providerReference: string,
    metadata: any,
    providerName: string
  ): Promise<void> {
    logger.info("Processing failed transaction", {
      reference: transaction.reference,
      providerReference,
    });

    // Update transaction
    await this.transactionRepository.update(transaction.id, {
      status: "failed",
      providerReference,
      meta: {
        ...transaction.meta,
        webhookData: {
          ...metadata,
          failedAt: new Date(),
          provider: providerName,
        },
      },
    });

    // Refund wallet only if transaction was pending
    if (transaction.status === "pending") {
      await this.refundWallet(
        transaction.sourceId.toString(),
        transaction.amount,
        `Transaction failed - ${transaction.reference}`,
        transaction.reference
      );

      logger.info("Failed transaction refunded", {
        reference: transaction.reference,
        refundedAmount: transaction.amount,
      });
    }

    // Send failure notification
    await this.sendNotification(transaction.sourceId, "transaction_failed", {
      transactionType: this.getTransactionTypeLabel(transaction.type),
      amount: transaction.amount,
      reference: transaction.reference,
      reason: metadata?.reason || "Transaction failed",
    });

    logger.info("Transaction marked as failed", {
      reference: transaction.reference,
      providerReference,
    });
  }

  //  Handle pending transaction
  private async handlePendingTransaction(
    transaction: any,
    providerReference: string,
    metadata: any,
    providerName: string
  ): Promise<void> {
    logger.info("Transaction still pending", {
      reference: transaction.reference,
      providerReference,
    });

    // Just update the provider reference and metadata
    await this.transactionRepository.update(transaction.id, {
      status: "pending",
      providerReference,
      meta: {
        ...transaction.meta,
        webhookData: {
          ...metadata,
          updatedAt: new Date(),
          provider: providerName,
        },
      },
    });
  }

  //  Refund wallet with logging
  private async refundWallet(
    userId: string,
    amount: number,
    description: string,
    reference: string
  ): Promise<void> {
    try {
      await this.walletService.creditWallet(
        userId,
        amount,
        description,
        "main"
      );
      logger.info("Wallet refunded successfully", {
        userId,
        amount,
        reference,
      });
    } catch (error) {
      logger.error("Wallet refund failed", {
        userId,
        amount,
        reference,
        error,
      });
      // Don't throw - log and continue to avoid blocking webhook processing
      // You might want to add this to a retry queue
    }
  }

  //  Send notification with error handling
  private async sendNotification(
    userId: Types.ObjectId,
    type: string,
    data: any
  ): Promise<void> {
    try {
      await this.notificationRepository.create({
        type,
        notifiableType: "User",
        notifiableId: userId,
        data,
      });
      logger.info("Notification sent", { userId, type });
    } catch (error) {
      logger.error("Notification send failed", {
        userId,
        type,
        error,
      });
      // Don't throw - notifications shouldn't block webhook processing
    }
  }

  //  Get human-readable transaction type label
  private getTransactionTypeLabel(type: string): string {
    const typeMap: { [key: string]: string } = {
      airtime: "Airtime Purchase",
      data: "Data Bundle",
      cable_tv: "Cable TV Subscription",
      electricity: "Electricity Payment",
      e_pin: "E-Pin Purchase",
      betting: "Betting Funding",
      internationalAirtime: "International Airtime",
      internationalData: "International Data",
    };

    return typeMap[type] || type.replace(/_/g, " ").toUpperCase();
  }
}
