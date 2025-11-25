import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "../client/WalletService";
import { ClubKonnectService } from "../client/providers/ClubkonnectService";
import logger from "@/logger";
import { Types } from "mongoose";

export class TransactionPollingService {
  private transactionRepository: TransactionRepository;
  private clubkonnectService: ClubKonnectService;
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;

  private readonly MAX_POLL_ATTEMPTS = 100;
  private readonly TIMEOUT_MINUTES = 30;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.clubkonnectService = new ClubKonnectService();
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
  }

  /**
   * Poll all pending Clubkonnect transactions that are due for polling
   */
  async pollPendingTransactions(): Promise<void> {
    try {
      const now = new Date();
      const timeoutThreshold = new Date(
        now.getTime() - this.TIMEOUT_MINUTES * 60 * 1000
      );

      // Find transactions needing polling
      const pendingTransactions = await this.transactionRepository.find({
        status: "pending",
        "polling.nextPollAt": { $lte: now },
        "polling.stoppedAt": { $exists: false }, // Not stopped yet
        createdAt: { $gte: timeoutThreshold }, // Within timeout window
      });

      logger.info(
        `Polling ${pendingTransactions.length} pending Clubkonnect transactions`
      );

      // Poll each transaction
      for (const transaction of pendingTransactions) {
        await this.pollSingleTransaction(transaction);
      }
    } catch (error: any) {
      logger.error("Error in pollPendingTransactions", error);
    }
  }

  /**
   * Poll a single transaction
   */
  private async pollSingleTransaction(transaction: any): Promise<void> {
    const transactionId = transaction._id || transaction.id;
    const polling = transaction.polling || {};

    try {
      logger.info(`Polling transaction ${transaction.reference}`, {
        pollCount: polling.pollCount,
        providerOrderId: polling.providerOrderId,
      });

      // Check stop conditions
      if (polling.pollCount >= this.MAX_POLL_ATTEMPTS) {
        await this.stopPolling(
          transactionId,
          transaction,
          "max_attempts",
          "Maximum polling attempts reached"
        );
        return;
      }

      const age = Date.now() - new Date(transaction.createdAt).getTime();
      if (age > this.TIMEOUT_MINUTES * 60 * 1000) {
        await this.stopPolling(
          transactionId,
          transaction,
          "timeout",
          "Polling timeout reached"
        );
        return;
      }

      // Query Clubkonnect for transaction status
      const queryResult = await this.clubkonnectService.queryTransaction(
        polling.providerOrderId,
        true // isOrderId
      );

      logger.info(`Query result for ${transaction.reference}`, queryResult);

      // Parse status
      const statusCode = parseInt(queryResult.statuscode || "0");
      const status = queryResult.status || "";

      // Handle different status codes
      if (statusCode === 200 && status === "ORDER_COMPLETED") {
        // SUCCESS
        await this.handleSuccess(transactionId, transaction, queryResult);
      } else if (this.isFailureStatus(statusCode, status)) {
        // FAILED, CANCELLED, or REFUNDED
        await this.handleFailure(transactionId, transaction, queryResult);
      } else {
        // Still pending (100, 300, 201, etc.)
        await this.scheduleNextPoll(transactionId, polling);
      }
    } catch (error: any) {
      logger.error(`Error polling transaction ${transaction.reference}`, error);

      // On error, schedule next poll (don't stop polling)
      await this.scheduleNextPoll(transactionId, polling);
    }
  }

  /**
   * Check if status indicates failure/cancellation/refund
   */
  private isFailureStatus(statusCode: number, status: string): boolean {
    // Handle explicit failure statuses
    const failureStatuses = [
      "ORDER_ERROR",
      "ORDER_CANCELLED",
      "ORDER_REFUNDED",
      "ORDER_FAILED",
    ];

    // Status code 800 = ORDER_REFUNDED (transaction failed and was refunded)
    if (statusCode === 800) {
      return true;
    }

    // Standard error codes (400-599)
    if (statusCode >= 400 && statusCode < 600) {
      return true;
    }

    // Check explicit failure status strings
    if (failureStatuses.includes(status)) {
      return true;
    }

    return false;
  }

  /**
   * Handle successful transaction
   */
  private async handleSuccess(
    transactionId: string,
    transaction: any,
    queryResult: any
  ): Promise<void> {
    logger.info(`Transaction ${transaction.reference} completed successfully`);

    await this.transactionRepository.update(transactionId, {
      status: "success",
      "polling.stoppedAt": new Date(),
      "polling.stopReason": "completed",
      "polling.lastPolledAt": new Date(),
    });

    // Send success notification
    if (this.notificationRepository) {
      await this.notificationRepository.create({
        type: "transaction_success",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(transaction.sourceId),
        data: {
          transactionType: this.getTransactionTypeLabel(transaction.type),
          amount: transaction.amount,
          reference: transaction.reference,
          token: queryResult.metertoken || queryResult.carddetails || undefined,
        },
      });
    }
  }

  /**
   * Handle failed transaction
   */
  private async handleFailure(
    transactionId: string,
    transaction: any,
    queryResult: any
  ): Promise<void> {
    logger.warn(
      `Transaction ${transaction.reference} failed - Status: ${queryResult.status} (${queryResult.statuscode})`,
      queryResult
    );

    // Refund user
    await this.walletService.creditWallet(
      transaction.sourceId.toString(),
      transaction.amount,
      `${this.getTransactionTypeLabel(transaction.type)} failed - refund`,
      "main"
    );

    await this.transactionRepository.update(transactionId, {
      status: "failed",
      "polling.stoppedAt": new Date(),
      "polling.stopReason": "failed",
      "polling.lastPolledAt": new Date(),
      failureReason: queryResult.remark || queryResult.status,
    });

    // Send failure notification
    if (this.notificationRepository) {
      await this.notificationRepository.create({
        type: "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(transaction.sourceId),
        data: {
          transactionType: this.getTransactionTypeLabel(transaction.type),
          amount: transaction.amount,
          reference: transaction.reference,
          reason: queryResult.remark || "Transaction failed",
        },
      });
    }
  }

  /**
   * Schedule next poll with smart intervals
   */
  private async scheduleNextPoll(
    transactionId: string,
    polling: any
  ): Promise<void> {
    const pollCount = (polling.pollCount || 0) + 1;

    // Smart intervals based on poll count
    let nextPollDelay: number;

    if (pollCount <= 12) {
      // First 2 minutes: every 10 seconds
      nextPollDelay = 10 * 1000;
    } else if (pollCount <= 18) {
      // Next 3 minutes: every 30 seconds
      nextPollDelay = 30 * 1000;
    } else if (pollCount <= 28) {
      // Next 10 minutes: every 60 seconds
      nextPollDelay = 60 * 1000;
    } else {
      // After 10 minutes: every 5 minutes
      nextPollDelay = 5 * 60 * 1000;
    }

    const nextPollAt = new Date(Date.now() + nextPollDelay);

    await this.transactionRepository.update(transactionId, {
      "polling.pollCount": pollCount,
      "polling.lastPolledAt": new Date(),
      "polling.nextPollAt": nextPollAt,
    });

    logger.info(`Scheduled next poll for transaction ${transactionId}`, {
      pollCount,
      nextPollAt,
    });
  }

  /**
   * Stop polling for a transaction
   */
  private async stopPolling(
    transactionId: string,
    transaction: any,
    reason: "completed" | "failed" | "timeout" | "max_attempts",
    message: string
  ): Promise<void> {
    logger.warn(
      `Stopping polling for transaction ${transaction.reference}: ${message}`
    );

    await this.transactionRepository.update(transactionId, {
      "polling.stoppedAt": new Date(),
      "polling.stopReason": reason,
      "polling.lastPolledAt": new Date(),
    });

    // For timeout or max_attempts, send admin alert
    if (reason === "timeout" || reason === "max_attempts") {
      logger.error(
        `Transaction ${transaction.reference} stuck in pending state`,
        {
          reason,
          pollCount: transaction.polling?.pollCount,
          age: Date.now() - new Date(transaction.createdAt).getTime(),
        }
      );

      // TODO: Send admin notification/alert
      // Consider refunding after manual review
    }
  }

  /**
   * Get human-readable transaction type label
   */
  private getTransactionTypeLabel(type: string): string {
    const labels: { [key: string]: string } = {
      airtime: "Airtime",
      data: "Data",
      cable_tv: "Cable TV",
      electricity: "Electricity",
      betting: "Betting",
      e_pin: "E-PIN",
      internationalAirtime: "International Airtime",
      internationalData: "International Data",
    };

    return labels[type] || type;
  }
}
