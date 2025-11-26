import { Payment } from "@/models/wallet/Payment";
import { Transaction } from "@/models/wallet/Transaction";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WebhookProcessResult } from "@/services/WebhookService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { generateReference } from "@/utils/helpers";
import { Types } from "mongoose";
import { VirtualAccount } from "@/models/banking/VirtualAccount";
import { WalletService } from "../WalletService";

/**
 * MONNIFY WEBHOOK SERVICE
 * Handles business logic for Monnify webhook events
 * 
 * Responsibilities:
 * 1. Process wallet funding (SUCCESSFUL_TRANSACTION)
 * 2. Process withdrawal success (SUCCESSFUL_DISBURSEMENT)
 * 3. Process withdrawal failure (FAILED_DISBURSEMENT)
 * 4. Process withdrawal reversal (REVERSED_DISBURSEMENT)
 * 5. Handle unsolicited payments
 * 6. Update Payment/Transaction records
 * 7. Credit/debit wallets
 * 8. Send notifications
 */
export class MonnifyWebhookService {
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.transactionRepository = new TransactionRepository();
  }

  /**
   * Main entry point for processing Monnify webhooks
   * Routes to appropriate handler based on metadata.eventType
   */
  async processWebhook(webhookData: WebhookProcessResult): Promise<void> {
    try {
      logger.info("Monnify webhook service: Processing webhook", {
        reference: webhookData.reference,
        eventType: webhookData.metadata?.eventType,
        status: webhookData.status,
      });

      const eventType = webhookData.metadata?.eventType;

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
        reference: webhookData.reference,
        eventType,
        status: webhookData.status,
      });
    } catch (error: any) {
      logger.error("Monnify webhook service: Processing error", {
        error: error.message,
        stack: error.stack,
        webhookData,
      });
      throw error;
    }
  }

  /**
   * Handle SUCCESSFUL_TRANSACTION (Wallet Funding)
   * 
   * Flow:
   * 1. Check idempotency (avoid duplicate processing)
   * 2. Find existing Payment by reference OR
   * 3. Find VirtualAccount by accountNumber (for unsolicited payments)
   * 4. Create/Update Payment record
   * 5. Credit user wallet
   * 6. Send notification
   */
  private async handleSuccessfulTransaction(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerReference, providerTransactionId, metadata } =
      webhookData;

    logger.info("Monnify: Processing successful transaction (wallet funding)", {
      reference,
      providerTransactionId,
      settlementAmount: metadata.settlementAmount,
      virtualAccountNumber: metadata.virtualAccountNumber,
    });

    // ===
    // STEP 1: Check Idempotency
    // Avoid processing the same webhook multiple times
    // ===
    const existingPayment = await Payment.findOne({
      providerTransactionId: providerTransactionId,
      "meta.provider": "monnify",
    });

    if (existingPayment && existingPayment.status === "success") {
      logger.info(
        "Monnify: Transaction already processed (idempotency check)",
        {
          reference,
          providerTransactionId,
          existingPaymentId: existingPayment._id,
        }
      );
      return; // Already processed
    }

    // ===
    // STEP 2: Try to find Payment by reference
    // This handles solicited payments (user initiated funding)
    // ===
    let payment = await Payment.findOne({
      reference: reference,
      type: "deposit",
    });

    let userId: Types.ObjectId;
    let isSolicited = true;

    if (payment) {
      // Solicited payment - User initiated this funding
      userId = payment.userId;
      logger.info("Monnify: Found existing Payment record (solicited)", {
        reference,
        paymentId: payment._id,
        userId,
      });
    } else {
      // ===
      // STEP 3: Unsolicited Payment
      // User transferred money without initiating payment in app
      // Find VirtualAccount by accountNumber to identify user
      // ===
      isSolicited = false;

      logger.info("Monnify: No Payment record found, checking VirtualAccount", {
        reference,
        virtualAccountNumber: metadata.virtualAccountNumber,
      });

      const virtualAccount = await VirtualAccount.findOne({
        accountNumber: metadata.virtualAccountNumber,
        provider: "monnify",
        isActive: true,
      });

      if (!virtualAccount) {
        logger.error(
          "Monnify: VirtualAccount not found for unsolicited payment",
          {
            reference,
            virtualAccountNumber: metadata.virtualAccountNumber,
            providerTransactionId,
          }
        );
        throw new AppError(
          "Virtual account not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      userId = virtualAccount.userId;

      logger.info("Monnify: Found VirtualAccount (unsolicited payment)", {
        reference,
        virtualAccountId: virtualAccount._id,
        userId,
        accountNumber: virtualAccount.accountNumber,
      });

      // Create new Payment record for unsolicited payment
      payment = await Payment.create({
        userId: userId,
        reference: generateReference("DEP"), // Generate new reference
        providerReference: providerReference,
        providerTransactionId: providerTransactionId,
        amount: metadata.amountPaid,
        amountPaid: metadata.settlementAmount,
        type: "deposit",
        status: "success",
        meta: {
          provider: "monnify",
          originalReference: reference, // Store original reference from webhook
          unsolicited: true,
          monnifyTransactionReference: metadata.monnifyTransactionReference,
          monnifyPaymentReference: metadata.monnifyPaymentReference,
          virtualAccountNumber: metadata.virtualAccountNumber,
          virtualBankName: metadata.virtualBankName,
          paymentMethod: metadata.paymentMethod,
          fees: metadata.fees,
          paymentSourceInformation: metadata.paymentSourceInformation,
          customer: metadata.customer,
          paidOn: metadata.paidOn,
          webhookReceivedAt: metadata.webhookReceivedAt,
        },
      });

      logger.info("Monnify: Created Payment record for unsolicited payment", {
        paymentId: payment._id,
        reference: payment.reference,
        originalReference: reference,
        userId,
      });
    }

    // ===
    // STEP 4: Update Payment Record (if solicited)
    // ===
    if (isSolicited) {
      payment.status = "success";
      payment.providerReference = providerReference;
      payment.providerTransactionId = providerTransactionId;
      payment.amountPaid = metadata.settlementAmount;
      payment.meta = {
        ...payment.meta,
        monnifyTransactionReference: metadata.monnifyTransactionReference,
        monnifyPaymentReference: metadata.monnifyPaymentReference,
        virtualAccountNumber: metadata.virtualAccountNumber,
        virtualBankName: metadata.virtualBankName,
        paymentMethod: metadata.paymentMethod,
        fees: metadata.fees,
        settlementAmount: metadata.settlementAmount,
        paymentSourceInformation: metadata.paymentSourceInformation,
        customer: metadata.customer,
        paidOn: metadata.paidOn,
        webhookReceivedAt: metadata.webhookReceivedAt,
      };

      await payment.save();

      logger.info("Monnify: Updated Payment record", {
        paymentId: payment._id,
        reference: payment.reference,
        status: payment.status,
      });
    }

    // ===
    // STEP 5: Credit User Wallet
    // Use settlement amount (amount after fees)
    // ===
    await this.walletService.creditWallet(
      userId,
      metadata.settlementAmount,
      `Wallet funding - ${payment.reference} (Monnify)`,
      "main"
    );

    logger.info("Monnify: Wallet credited", {
      userId,
      amount: metadata.settlementAmount,
      reference: payment.reference,
    });

    // ===
    // STEP 6: Send Notification
    // ===
    await this.notificationRepository.create({
      type: isSolicited ? "payment_success" : "unsolicited_payment",
      notifiableType: "User",
      notifiableId: userId,
      data: {
        transactionType: "Wallet Funding",
        amount: metadata.settlementAmount,
        amountPaid: metadata.amountPaid,
        fees: metadata.fees,
        reference: payment.reference,
        provider: "monnify",
        paymentMethod: metadata.paymentMethod,
        paidOn: metadata.paidOn,
        unsolicited: !isSolicited,
      },
    });

    logger.info("Monnify: Notification sent", {
      userId,
      type: isSolicited ? "payment_success" : "unsolicited_payment",
      reference: payment.reference,
    });
  }

  /**
   * Handle SUCCESSFUL_DISBURSEMENT (Withdrawal Transaction Success)
   * 
   * Flow:
   * 1. Find Payment by reference
   * 2. Find Transaction by reference
   * 3. Update Payment status to "success"
   * 4. Update Transaction status to "success"
   * 5. Send success notification
   */
  private async handleSuccessfulDisbursement(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerReference, providerTransactionId, metadata } =
      webhookData;

    logger.info("Monnify: Processing successful disbursement (withdrawal)", {
      reference,
      providerTransactionId,
      amount: metadata.amount,
      destinationAccount: metadata.destinationAccountNumber,
    });

    // ===
    // STEP 1: Find Payment Record
    // ===
    const payment = await Payment.findOne({
      reference: reference,
      type: "withdrawal",
    });

    if (!payment) {
      logger.error("Monnify: Payment not found for disbursement", {
        reference,
        providerTransactionId,
      });
      throw new AppError(
        "Payment not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Check idempotency
    if (payment.status === "success") {
      logger.info(
        "Monnify: Disbursement already processed (idempotency check)",
        {
          reference,
          paymentId: payment._id,
        }
      );
      return;
    }

    logger.info("Monnify: Found Payment record", {
      paymentId: payment._id,
      reference,
      userId: payment.userId,
    });

    // ===
    // STEP 2: Find Transaction Record
    // ===
    const transaction = await this.transactionRepository.findOne({
      reference: reference,
      type: { $in: ["withdrawal", "bank_transfer"] },
    });

    if (!transaction) {
      logger.warn("Monnify: Transaction record not found", {
        reference,
      });
    } else {
      logger.info("Monnify: Found Transaction record", {
        transactionId: transaction._id,
        reference,
      });
    }

    // ===
    // STEP 3: Update Payment Status
    // ===
    payment.status = "success";
    payment.providerTransactionId = providerTransactionId;
    payment.meta = {
      ...payment.meta,
      monnifyTransactionReference: metadata.monnifyTransactionReference,
      sessionId: metadata.sessionId,
      transactionDescription: metadata.transactionDescription,
      fee: metadata.fee,
      completedOn: metadata.completedOn,
      webhookReceivedAt: metadata.webhookReceivedAt,
    };

    await payment.save();

    logger.info("Monnify: Payment updated to success", {
      paymentId: payment._id,
      reference,
    });

    // ===
    // STEP 4: Update Transaction Status
    // ===
    if (transaction) {
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "success",
        providerReference: metadata.monnifyTransactionReference,
        meta: {
          ...transaction.meta,
          monnifyTransactionReference: metadata.monnifyTransactionReference,
          completedOn: metadata.completedOn,
          fee: metadata.fee,
        },
      });

      logger.info("Monnify: Transaction updated to success", {
        transactionId: transaction._id,
        reference,
      });
    }

    // ===
    // STEP 5: Send Success Notification
    // ===
    await this.notificationRepository.create({
      type: "withdrawal_completed",
      notifiableType: "User",
      notifiableId: payment.userId,
      data: {
        transactionType: transaction?.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal",
        amount: metadata.amount,
        fee: metadata.fee,
        reference: reference,
        provider: "monnify",
        destinationAccountNumber: metadata.destinationAccountNumber,
        destinationAccountName: metadata.destinationAccountName,
        destinationBankName: metadata.destinationBankName,
        completedOn: metadata.completedOn,
      },
    });

    logger.info("Monnify: Success notification sent", {
      userId: payment.userId,
      reference,
    });
  }

  /**
   * Handle FAILED_DISBURSEMENT (Withdrawal Transaction Failed)
   * 
   * Flow:
   * 1. Find Payment by reference
   * 2. Find Transaction by reference
   * 3. Update Payment status to "failed"
   * 4. Update Transaction status to "failed"
   * 5. Refund wallet (credit back)
   * 6. Send failure notification
   */
  private async handleFailedDisbursement(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerReference, providerTransactionId, metadata } =
      webhookData;

    logger.info("Monnify: Processing failed disbursement (withdrawal)", {
      reference,
      providerTransactionId,
      amount: metadata.amount,
      failureReason: metadata.failureReason,
    });

    // ===
    // STEP 1: Find Payment Record
    // ===
    const payment = await Payment.findOne({
      reference: reference,
      type: "withdrawal",
    });

    if (!payment) {
      logger.error("Monnify: Payment not found for failed disbursement", {
        reference,
        providerTransactionId,
      });
      throw new AppError(
        "Payment not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Check idempotency
    if (payment.status === "failed") {
      logger.info(
        "Monnify: Failed disbursement already processed (idempotency check)",
        {
          reference,
          paymentId: payment._id,
        }
      );
      return;
    }

    logger.info("Monnify: Found Payment record", {
      paymentId: payment._id,
      reference,
      userId: payment.userId,
    });

    // ===
    // STEP 2: Find Transaction Record
    // ===
    const transaction = await this.transactionRepository.findOne({
      reference: reference,
      type: { $in: ["withdrawal", "bank_transfer"] },
    });

    if (!transaction) {
      logger.warn("Monnify: Transaction record not found", {
        reference,
      });
    } else {
      logger.info("Monnify: Found Transaction record", {
        transactionId: transaction._id,
        reference,
      });
    }

    // ===
    // STEP 3: Update Payment Status
    // ===
    payment.status = "failed";
    payment.providerTransactionId = providerTransactionId;
    payment.meta = {
      ...payment.meta,
      monnifyTransactionReference: metadata.monnifyTransactionReference,
      failureReason: metadata.failureReason,
      transactionDescription: metadata.transactionDescription,
      completedOn: metadata.completedOn,
      webhookReceivedAt: metadata.webhookReceivedAt,
    };

    await payment.save();

    logger.info("Monnify: Payment updated to failed", {
      paymentId: payment._id,
      reference,
    });

    // ===
    // STEP 4: Update Transaction Status
    // ===
    if (transaction) {
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "failed",
        providerReference: metadata.monnifyTransactionReference,
        meta: {
          ...transaction.meta,
          monnifyTransactionReference: metadata.monnifyTransactionReference,
          failureReason: metadata.failureReason,
          completedOn: metadata.completedOn,
        },
      });

      logger.info("Monnify: Transaction updated to failed", {
        transactionId: transaction._id,
        reference,
      });
    }

    // ===
    // STEP 5: Refund Wallet
    // Credit back the amount that was debited during withdrawal initiation
    // ===
    await this.walletService.creditWallet(
      payment.userId,
      metadata.amount,
      `Withdrawal refund - ${reference} (Failed)`,
      "main"
    );

    logger.info("Monnify: Wallet refunded", {
      userId: payment.userId,
      amount: metadata.amount,
      reference,
    });

    // ===
    // STEP 6: Send Failure Notification
    // ===
    await this.notificationRepository.create({
      type: "withdrawal_failed",
      notifiableType: "User",
      notifiableId: payment.userId,
      data: {
        transactionType: transaction?.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal",
        amount: metadata.amount,
        reference: reference,
        provider: "monnify",
        failureReason: metadata.failureReason,
        refunded: true,
      },
    });

    logger.info("Monnify: Failure notification sent", {
      userId: payment.userId,
      reference,
    });
  }

  /**
   * Handle REVERSED_DISBURSEMENT (Withdrawal Transaction Reversed)
   * 
   * Flow:
   * 1. Find Payment by reference
   * 2. Find Transaction by reference
   * 3. Update Payment status to "reversed"
   * 4. Update Transaction status to "reversed"
   * 5. Refund wallet (credit back)
   * 6. Send reversal notification
   */
  private async handleReversedDisbursement(
    webhookData: WebhookProcessResult
  ): Promise<void> {
    const { reference, providerReference, providerTransactionId, metadata } =
      webhookData;

    logger.info("Monnify: Processing reversed disbursement (withdrawal)", {
      reference,
      providerTransactionId,
      amount: metadata.amount,
    });

    // ===
    // STEP 1: Find Payment Record
    // ===
    const payment = await Payment.findOne({
      reference: reference,
      type: "withdrawal",
    });

    if (!payment) {
      logger.error("Monnify: Payment not found for reversed disbursement", {
        reference,
        providerTransactionId,
      });
      throw new AppError(
        "Payment not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // Check idempotency
    if (payment.status === "reversed") {
      logger.info(
        "Monnify: Reversed disbursement already processed (idempotency check)",
        {
          reference,
          paymentId: payment._id,
        }
      );
      return;
    }

    logger.info("Monnify: Found Payment record", {
      paymentId: payment._id,
      reference,
      userId: payment.userId,
    });

    // ===
    // STEP 2: Find Transaction Record
    // ===
    const transaction = await this.transactionRepository.findOne({
      reference: reference,
      type: { $in: ["withdrawal", "bank_transfer"] },
    });

    if (!transaction) {
      logger.warn("Monnify: Transaction record not found", {
        reference,
      });
    } else {
      logger.info("Monnify: Found Transaction record", {
        transactionId: transaction._id,
        reference,
      });
    }

    // ===
    // STEP 3: Update Payment Status
    // ===
    payment.status = "reversed";
    payment.providerTransactionId = providerTransactionId;
    payment.meta = {
      ...payment.meta,
      monnifyTransactionReference: metadata.monnifyTransactionReference,
      reversalReason: "Disbursement reversed by Monnify",
      completedOn: metadata.completedOn,
      webhookReceivedAt: metadata.webhookReceivedAt,
    };

    await payment.save();

    logger.info("Monnify: Payment updated to reversed", {
      paymentId: payment._id,
      reference,
    });

    // ===
    // STEP 4: Update Transaction Status
    // ===
    if (transaction) {
      await this.transactionRepository.update(transaction.id.toString(), {
        status: "reversed",
        providerReference: metadata.monnifyTransactionReference,
        meta: {
          ...transaction.meta,
          monnifyTransactionReference: metadata.monnifyTransactionReference,
          reversalReason: "Disbursement reversed by Monnify",
          completedOn: metadata.completedOn,
        },
      });

      logger.info("Monnify: Transaction updated to reversed", {
        transactionId: transaction._id,
        reference,
      });
    }

    // ===
    // STEP 5: Refund Wallet
    // Credit back the amount that was debited
    // ===
    await this.walletService.creditWallet(
      payment.userId,
      metadata.amount,
      `Withdrawal refund - ${reference} (Reversed)`,
      "main"
    );

    logger.info("Monnify: Wallet refunded (reversal)", {
      userId: payment.userId,
      amount: metadata.amount,
      reference,
    });

    // ===
    // STEP 6: Send Reversal Notification
    // ===
    await this.notificationRepository.create({
      type: "withdrawal_reversed",
      notifiableType: "User",
      notifiableId: payment.userId,
      data: {
        transactionType: transaction?.type === "bank_transfer" ? "Bank Transfer" : "Withdrawal",
        amount: metadata.amount,
        reference: reference,
        provider: "monnify",
        reason: "Disbursement reversed by provider",
        refunded: true,
      },
    });

    logger.info("Monnify: Reversal notification sent", {
      userId: payment.userId,
      reference,
    });
  }
}