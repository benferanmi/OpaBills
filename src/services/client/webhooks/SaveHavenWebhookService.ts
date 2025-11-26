import { Payment } from "@/models/wallet/Payment";
import { Transaction } from "@/models/wallet/Transaction";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { VirtualAccountRepository } from "@/repositories/VirtualAccountRepository";
import { PaymentRepository } from "@/repositories/PaymentRepository";
import { WalletService } from "../WalletService";
import { WebhookProcessResult } from "@/services/WebhookService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { generateReference } from "@/utils/helpers";

/**
 * SAVEHAVEN WEBHOOK SERVICE
 * Handles business logic for SaveHaven webhook events
 * 
 * Responsibilities:
 * 1. Process wallet funding (Inwards transfers)
 * 2. Process withdrawal success/failure (Outwards transfers)
 * 3. Handle unsolicited payments
 * 4. Update Payment/Transaction records
 * 5. Credit/debit wallets
 * 6. Send notifications
 */
export class SaveHavenWebhookService {
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private transactionRepository: TransactionRepository;
  private virtualAccountRepository: VirtualAccountRepository;
  private paymentRepository: PaymentRepository;

  constructor() {
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.transactionRepository = new TransactionRepository();
    this.virtualAccountRepository = new VirtualAccountRepository();
    this.paymentRepository = new PaymentRepository();
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
   * Flow:
   * 1. Find user by virtual account
   * 2. Create or update Payment record
   * 3. Credit wallet if successful
   * 4. Send notification
   */
  private async handleWalletFunding(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { providerTransactionId, providerReference, status, metadata } =
      webhookData;

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
        provider: "savehaven",
        isActive: true,
      });

      if (!virtualAccount) {
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
      // STEP 2: Find or create Payment record
      // ===
      let payment = await this.paymentRepository.findByProviderReference(
        providerReference,
        "saveHaven"
      );

      if (!payment) {
        // Create new payment record (unsolicited payment)
        logger.info("SaveHaven: Creating new payment record", {
          userId,
          providerTransactionId,
        });

        payment = await this.paymentRepository.createPayment({
          userId: userId,
          reference: generateReference("DEP"),
          providerReference: providerReference,
          providerTransactionId: providerTransactionId,
          amount: metadata.amount,
          amountPaid: metadata.netAmount,
          type: "deposit",
          status: status,
          meta: {
            provider: "saveHaven",
            unsolicited: true,
            virtualAccount: {
              accountNumber: metadata.creditAccountNumber,
              accountName: metadata.creditAccountName,
              bankName: virtualAccount.bankName,
              provider: "saveHaven",
            },
            webhookData: metadata,
            fees: metadata.fees,
            vat: metadata.vat,
            stampDuty: metadata.stampDuty,
            netAmount: metadata.netAmount,
          },
        } as any);

        logger.info("SaveHaven: Payment record created", {
          paymentId: payment._id,
          reference: payment.reference,
          userId,
        });
      } else {
        // Update existing payment
        logger.info("SaveHaven: Updating existing payment", {
          paymentId: payment._id,
          providerTransactionId,
        });

        payment = await this.paymentRepository.updatePaymentStatus(
          payment.id.toString(),
          status,
          {
            providerTransactionId: providerTransactionId,
            amountPaid: metadata.netAmount,
            meta: {
              ...payment.meta,
              webhookData: metadata,
              fees: metadata.fees,
              vat: metadata.vat,
              stampDuty: metadata.stampDuty,
              netAmount: metadata.netAmount,
              updatedAt: new Date(),
            },
          } as any
        );

        logger.info("SaveHaven: Payment record updated", {
          paymentId: payment?.id || "",
          status,
        });
      }

      if (!payment) {
        throw new AppError(
          "Failed to update payment record",
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.DATABASE_ERROR
        );
      }

      // ===
      // STEP 3: Process based on status
      // ===
      if (status === "success") {
        // Credit user wallet with net amount (after fees)
        await this.walletService.creditWallet(
          userId.toString(),
          metadata.netAmount,
          `Wallet funding via SaveHaven - ${payment.reference}`,
          "main"
        );

        logger.info("SaveHaven: Wallet credited", {
          userId: userId.toString(),
          amount: metadata.netAmount,
          reference: payment.reference,
        });

        // Send success notification
        await this.notificationRepository.create({
          type: "payment_success",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType: "Wallet Funding",
            amount: metadata.netAmount,
            reference: payment.reference,
            provider: "SaveHaven",
            fees: metadata.fees,
          },
        });

        logger.info("SaveHaven: Wallet funded successfully", {
          userId: userId.toString(),
          amount: metadata.netAmount,
          reference: payment.reference,
          providerTransactionId,
        });
      } else if (status === "reversed") {
        // Handle reversal
        logger.warn("SaveHaven: Payment reversed", {
          providerTransactionId,
          reference: payment.reference,
        });

        // Send reversal notification
        await this.notificationRepository.create({
          type: "payment_reversed",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType: "Wallet Funding",
            amount: metadata.netAmount,
            reference: payment.reference,
            provider: "SaveHaven",
            reason: metadata.responseMessage,
          },
        });
      } else if (status === "failed") {
        // Send failure notification
        await this.notificationRepository.create({
          type: "payment_failed",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType: "Wallet Funding",
            amount: metadata.amount,
            reference: payment.reference,
            provider: "SaveHaven",
            reason: metadata.responseMessage,
          },
        });

        logger.info("SaveHaven: Payment failed", {
          providerTransactionId,
          reference: payment.reference,
          reason: metadata.responseMessage,
        });
      }
    } catch (error) {
      logger.error("SaveHaven: Wallet funding error", {
        error,
        providerTransactionId,
      });
      throw error;
    }
  }

  /**
   * Handle withdrawal completion (Outwards transfers)
   * 
   * Flow:
   * 1. Find Payment record by reference
   * 2. Find Transaction record by reference
   * 3. Update Payment status
   * 4. Update Transaction status
   * 5. Refund wallet if failed/reversed
   * 6. Send notification
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
      logger.info("SaveHaven: Processing withdrawal", {
        reference,
        providerTransactionId,
        amount: metadata.amount,
        status,
      });

      // ===
      // STEP 1: Find Payment record by reference
      // ===
      const payment = await this.paymentRepository.findOne({
        reference: reference,
        type: "withdrawal",
        "meta.provider": "saveHaven",
      });

      if (!payment) {
        logger.error("SaveHaven: Withdrawal payment not found", {
          reference,
          providerTransactionId,
        });
        throw new AppError(
          "Withdrawal payment not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      logger.info("SaveHaven: Found payment record", {
        paymentId: payment._id,
        reference,
        userId: payment.userId,
      });

      // ===
      // STEP 2: Check idempotency
      // ===
      if (payment.status === "success" || payment.status === "failed") {
        logger.info("SaveHaven: Withdrawal already processed", {
          paymentId: payment._id,
          currentStatus: payment.status,
          webhookStatus: status,
        });
        return;
      }

      // ===
      // STEP 3: Find Transaction Record
      // ===
      const transaction = await this.transactionRepository.findOne({
        reference: reference,
        type: { $in: ["withdrawal", "bank_transfer"] },
      });

      if (!transaction) {
        logger.warn("SaveHaven: Withdrawal Transaction not found", {
          reference,
        });
      } else {
        logger.info("SaveHaven: Found Withdrawal Transaction record", {
          transactionId: transaction._id,
          reference,
        });
      }

      // ===
      // STEP 4: Update Payment Record
      // ===
      const updatedPayment = await this.paymentRepository.updatePaymentStatus(
        payment.id.toString(),
        status,
        {
          providerTransactionId: providerTransactionId,
          providerReference: providerReference,
          meta: {
            ...payment.meta,
            webhookData: metadata,
            fees: metadata.fees,
            vat: metadata.vat,
            stampDuty: metadata.stampDuty,
            updatedAt: new Date(),
          },
        } as any
      );

      logger.info("SaveHaven: Payment updated", {
        paymentId: payment._id,
        status,
      });

      // ===
      // STEP 5: Update Transaction Record
      // ===
      if (transaction) {
        const transactionStatus = this.mapPaymentStatusToTransaction(status);
        
        await this.transactionRepository.update(transaction.id.toString(), {
          status: transactionStatus,
          providerReference: providerTransactionId,
          meta: {
            ...transaction.meta,
            providerTransactionId: providerTransactionId,
            webhookData: metadata,
            fees: metadata.fees,
            updatedAt: new Date(),
          },
        });

        logger.info("SaveHaven: Transaction updated", {
          transactionId: transaction._id,
          status: transactionStatus,
        });
      }

      // ===
      // STEP 6: Handle based on status
      // ===
      const userId = transaction?.sourceId || payment.userId;
      const amount = transaction?.amount || payment.amount;

      if (status === "success") {
        // Send success notification
        await this.notificationRepository.create({
          type: "withdrawal_completed",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType: transaction?.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal",
            amount: amount,
            reference: reference,
            provider: "SaveHaven",
            accountNumber: payment.meta?.accountNumber,
            bankName: payment.meta?.bankName,
          },
        });

        logger.info("SaveHaven: Withdrawal completed successfully", {
          reference: reference,
          amount: amount,
          providerTransactionId,
        });
      } else if (status === "failed" || status === "reversed") {
        // Refund user wallet
        await this.walletService.creditWallet(
          userId.toString(),
          amount,
          `Withdrawal ${status} - ${reference} (SaveHaven)`,
          "main"
        );

        logger.info(`SaveHaven: Wallet refunded for ${status} withdrawal`, {
          userId: userId.toString(),
          amount: amount,
          reference,
        });

        // Send failure/reversal notification
        await this.notificationRepository.create({
          type:
            status === "reversed" ? "withdrawal_reversed" : "withdrawal_failed",
          notifiableType: "User",
          notifiableId: userId,
          data: {
            transactionType: transaction?.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal",
            amount: amount,
            reference: reference,
            provider: "SaveHaven",
            reason: metadata.responseMessage,
            refunded: true,
          },
        });

        logger.info(`SaveHaven: Withdrawal ${status} and refunded`, {
          reference: reference,
          amount: amount,
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
   */
  private async checkIdempotency(
    providerTransactionId?: string
  ): Promise<boolean> {
    if (!providerTransactionId) return false;

    const existingPayment =
      await this.paymentRepository.findByProviderTransactionId(
        providerTransactionId,
        "saveHaven"
      );

    return !!existingPayment;
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