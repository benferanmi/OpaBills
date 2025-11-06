import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { AppError } from "@/middlewares/errorHandler";
import { generateReference } from "@/utils/helpers";
import logger from "@/logger";

/**
 * Transaction metadata for creating a transaction
 */
interface TransactionMetadata {
  walletId: Types.ObjectId;
  sourceId: Types.ObjectId;
  transactableType?: string;
  transactableId?: Types.ObjectId | string;
  amount: number;
  type: string;
  remark: string;
  purpose: string;
  provider?: string;
  direction?: "DEBIT" | "CREDIT";
  meta?: Record<string, any>;
}

/**
 * Provider operation result
 */
interface ProviderResponse {
  success: boolean;
  pending?: boolean;
  providerReference?: string;
  status?: string;
  message?: string;
  data?: any;
  token?: string;
}

/**
 * Notification data
 */
interface NotificationData {
  type: string;
  notifiableType: string;
  notifiableId: Types.ObjectId;
  data: Record<string, any>;
}

/**
 * Transaction orchestration request
 */
interface TransactionRequest {
  userId: string;
  amount: number;
  referencePrefix: string;
  transactionType: string;
  purpose: string;
  remark: string;
  transactableType?: string;
  transactableId?: Types.ObjectId | string;
  provider?: string;
  meta?: Record<string, any>;
  successNotification?: Omit<NotificationData, "notifiableId" | "notifiableType">;
  failureNotification?: Omit<NotificationData, "notifiableId" | "notifiableType">;
}

/**
 * Transaction orchestration result
 */
interface TransactionResult {
  transaction: any;
  status: "success" | "pending" | "failed";
  providerStatus?: string;
  providerData?: any;
  token?: string;
  pending: boolean;
}

/**
 * TransactionOrchestrator
 * 
 * Handles the standard transaction flow for all bill payment operations:
 * 1. Validates wallet balance
 * 2. Debits wallet
 * 3. Creates transaction record
 * 4. Executes provider operation
 * 5. Updates transaction status
 * 6. Handles refunds on failure
 * 7. Sends notifications
 * 
 * This eliminates duplicated transaction logic across multiple services.
 */
export class TransactionOrchestrator {
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
  }

  /**
   * Execute a complete transaction flow with provider operation
   * 
   * @param request - Transaction request details
   * @param providerOperation - Async function that calls the provider
   * @returns Transaction result with status and provider data
   */
  async executeTransaction(
    request: TransactionRequest,
    providerOperation: (reference: string) => Promise<ProviderResponse>
  ): Promise<TransactionResult> {
    const reference = generateReference(request.referencePrefix);
    
    // Step 1: Validate wallet and balance
    const wallet = await this.validateWallet(request.userId, request.amount);
    
    // Step 2: Debit wallet
    await this.walletService.debitWallet(
      request.userId,
      request.amount,
      request.remark,
      "main"
    );

    // Step 3: Create pending transaction
    const transaction = await this.createTransaction({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(request.userId),
      transactableType: request.transactableType,
      transactableId: request.transactableId,
      reference,
      amount: request.amount,
      type: request.transactionType,
      remark: request.remark,
      purpose: request.purpose,
      provider: request.provider,
      direction: "DEBIT",
      meta: request.meta,
    });

    try {
      // Step 4: Execute provider operation
      const providerResponse = await providerOperation(reference);

      // Step 5: Determine final status
      const status = this.determineTransactionStatus(providerResponse);

      // Step 6: Update transaction
      await this.transactionRepository.update(transaction.id, {
        status,
        providerReference: providerResponse.providerReference,
      });

      // Step 7: Handle success notification
      if (status === "success" && request.successNotification) {
        await this.sendNotification({
          ...request.successNotification,
          notifiableType: "User",
          notifiableId: new Types.ObjectId(request.userId),
          data: {
            ...request.successNotification.data,
            reference,
          },
        });
      }

      // Step 8: Handle failure refund
      if (status === "failed") {
        await this.handleFailedTransaction(
          request.userId,
          request.amount,
          request.remark,
          reference,
          request.failureNotification
        );
      }

      return {
        transaction: transaction.toObject(),
        status,
        providerStatus: providerResponse.status,
        providerData: providerResponse.data,
        token: providerResponse.token,
        pending: status === "pending",
      };
    } catch (error: any) {
      // Step 9: Handle errors with refund
      await this.handleTransactionError(
        transaction.id,
        request.userId,
        request.amount,
        request.remark
      );
      throw error;
    }
  }

  /**
   * Validate wallet exists and has sufficient balance
   */
  private async validateWallet(userId: string, amount: number) {
    const wallet = await this.walletService.getWallet(userId);
    
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (wallet.balance < amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    return wallet;
  }

  /**
   * Create a transaction record
   */
  private async createTransaction(data: TransactionMetadata & { reference: string }) {
    return await this.transactionRepository.create({
      ...data,
      status: "pending",
    });
  }

  /**
   * Determine transaction status from provider response
   */
  private determineTransactionStatus(
    providerResponse: ProviderResponse
  ): "success" | "pending" | "failed" {
    if (providerResponse.success) {
      return "success";
    } else if (providerResponse.pending) {
      return "pending";
    } else {
      return "failed";
    }
  }

  /**
   * Handle failed transaction with refund and notification
   */
  private async handleFailedTransaction(
    userId: string,
    amount: number,
    remark: string,
    reference: string,
    failureNotification?: Omit<NotificationData, "notifiableId" | "notifiableType">
  ) {
    // Refund the user
    await this.walletService.creditWallet(
      userId,
      amount,
      `${remark} - refund`,
      "main"
    );

    // Send failure notification if configured
    if (failureNotification) {
      await this.sendNotification({
        ...failureNotification,
        notifiableType: "User",
        notifiableId: new Types.ObjectId(userId),
        data: {
          ...failureNotification.data,
          reference,
        },
      });
    }

    logger.info(`Transaction failed and refunded: ${reference}`, {
      userId,
      amount,
    });
  }

  /**
   * Handle transaction error with status update and refund
   */
  private async handleTransactionError(
    transactionId: string,
    userId: string,
    amount: number,
    remark: string
  ) {
    await this.transactionRepository.updateStatus(transactionId, "failed");
    await this.walletService.creditWallet(
      userId,
      amount,
      `${remark} - error refund`,
      "main"
    );

    logger.error(`Transaction error with refund: ${transactionId}`, {
      userId,
      amount,
    });
  }

  /**
   * Send a notification
   */
  private async sendNotification(data: NotificationData) {
    try {
      await this.notificationRepository.create(data);
    } catch (error: any) {
      logger.error("Failed to send notification", {
        type: data.type,
        error: error.message,
      });
      // Don't throw - notification failure shouldn't break the transaction
    }
  }

  /**
   * Get transaction history with pagination
   */
  async getTransactionHistory(
    userId: string,
    type: string | string[],
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {
      sourceId: userId,
    };

    if (Array.isArray(type)) {
      query.type = { $in: type };
    } else {
      query.type = type;
    }

    return this.transactionRepository.findWithPagination(query, page, limit);
  }

  /**
   * Get filtered transactions with date range and status
   */
  async getFilteredTransactions(
    userId: string,
    filters: {
      type?: string | string[];
      status?: string;
      startDate?: string;
      endDate?: string;
    },
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {
      sourceId: userId,
    };

    if (filters.type) {
      query.type = Array.isArray(filters.type)
        ? { $in: filters.type }
        : filters.type;
    }

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

    return this.transactionRepository.findWithPagination(query, page, limit);
  }
}