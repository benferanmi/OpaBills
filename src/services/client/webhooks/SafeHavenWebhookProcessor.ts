import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { WebhookProcessResult } from "../../WebhookService";

/**
 * SafeHaven webhook payload structures
 */
interface SafeHavenTransferWebhook {
  type: "transfer" | "virtualAccount.transfer";
  data: {
    _id: string; // SafeHaven's unique transaction ID
    client: string;
    account?: string; // For regular transfers
    virtualAccount?: string; // For virtual account transfers
    type: "Inwards" | "Outwards";
    sessionId: string;
    nameEnquiryReference: string;
    paymentReference: string;
    mandateReference: string | null;
    isReversed: boolean;
    reversalReference: string | null;
    provider: string;
    providerChannel: string;
    providerChannelCode: string;
    destinationInstitutionCode: string;
    creditAccountName: string;
    creditAccountNumber: string;
    creditBankVerificationNumber: string | null;
    creditKYCLevel: string;
    debitAccountName: string;
    debitAccountNumber: string;
    debitBankVerificationNumber: string | null;
    debitKYCLevel: string;
    transactionLocation: string;
    narration: string;
    amount: number;
    fees: number;
    vat: number;
    stampDuty: number;
    responseCode: string;
    responseMessage: string;
    status: "Completed" | "Pending" | "Failed" | "Declined";
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    approvedAt?: string;
    declinedAt?: string;
  };
}

/**
 * SAFEHAVEN WEBHOOK PROCESSOR
 * Handles SafeHaven-specific webhook payload parsing
 * Supports both regular transfers and virtual account transfers
 */
export class SafeHavenWebhookProcessor {
  /**
   * Validate SafeHaven webhook payload structure
   */
  validatePayload(payload: any): boolean {
    try {
      // Check required fields
      if (!payload || typeof payload !== "object") {
        logger.error("SafeHaven webhook: Invalid payload structure", { payload });
        return false;
      }

      // Check webhook type
      if (!["transfer", "virtualAccount.transfer"].includes(payload.type)) {
        logger.error("SafeHaven webhook: Invalid webhook type", {
          type: payload.type,
        });
        return false;
      }

      // Check data object
      if (!payload.data || typeof payload.data !== "object") {
        logger.error("SafeHaven webhook: Missing data object", { payload });
        return false;
      }

      // Check required data fields
      const requiredFields = [
        "_id",
        "paymentReference",
        "creditAccountNumber",
        "amount",
        "status",
        "type", // Inwards or Outwards
      ];

      for (const field of requiredFields) {
        if (!payload.data[field]) {
          logger.error(`SafeHaven webhook: Missing required field: ${field}`, {
            payload,
          });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error("SafeHaven webhook: Validation error", { error, payload });
      return false;
    }
  }

  /**
   * Process SafeHaven webhook and extract transaction data
   */
  async process(payload: SafeHavenTransferWebhook): Promise<WebhookProcessResult> {
    try {
      logger.info("SafeHaven webhook: Processing payload", {
        type: payload.type,
        transactionId: payload.data._id,
        status: payload.data.status,
        transferType: payload.data.type,
        amount: payload.data.amount,
      });

      // Validate payload
      if (!this.validatePayload(payload)) {
        throw new AppError(
          "Invalid SafeHaven webhook payload",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const { data } = payload;

      // Map SafeHaven status to our standard status
      const status = this.mapStatus(data.status, data.isReversed);

      // Extract metadata
      const metadata = this.extractMetadata(payload);

      // Determine reference based on transfer direction
      const reference = this.extractReference(data);

      const result: WebhookProcessResult = {
        reference, // Our internal reference
        providerReference: data.paymentReference, // SafeHaven's payment reference
        providerTransactionId: data._id, // SafeHaven's unique transaction ID
        status,
        metadata: {
          ...metadata,
          webhookType: payload.type,
          transferType: data.type, // Inwards or Outwards
          creditAccountNumber: data.creditAccountNumber,
          debitAccountNumber: data.debitAccountNumber,
        },
      };

      logger.info("SafeHaven webhook: Processing completed", {
        reference,
        providerReference: data.paymentReference,
        providerTransactionId: data._id,
        status,
        transferType: data.type,
      });

      return result;
    } catch (error) {
      logger.error("SafeHaven webhook: Processing error", { error, payload });
      throw error;
    }
  }

  /**
   * Extract reference based on transfer type
   * For Inwards: We might not have a reference, will use account number
   * For Outwards: Extract from narration or use paymentReference
   */
  private extractReference(data: SafeHavenTransferWebhook["data"]): string {
    // For Outwards (withdrawals), try to extract from narration
    if (data.type === "Outwards") {
      // Narration format: "Withdrawal - WTH_1234567890"
      const narrationMatch = data.narration.match(/WTH_\w+|PAY_\w+|BTR_\w+/);
      if (narrationMatch) {
        return narrationMatch[0];
      }
    }

    // For Inwards or if extraction failed, use paymentReference
    // This will be matched against VirtualAccount.accountNumber
    return data.paymentReference;
  }

  /**
   * Map SafeHaven status to our standard status
   */
  private mapStatus(
    safeHavenStatus: string,
    isReversed: boolean
  ): "success" | "pending" | "failed" | "reversed" {
    // Check if transaction is reversed
    if (isReversed) {
      return "reversed";
    }

    // Map status
    switch (safeHavenStatus) {
      case "Completed":
        return "success";
      case "Pending":
        return "pending";
      case "Failed":
      case "Declined":
        return "failed";
      default:
        logger.warn("SafeHaven webhook: Unknown status, defaulting to pending", {
          safeHavenStatus,
        });
        return "pending";
    }
  }

  /**
   * Extract metadata from SafeHaven webhook
   */
  private extractMetadata(payload: SafeHavenTransferWebhook): any {
    const data = payload.data;

    return {
      // SafeHaven specific fields
      safeHavenTransactionId: data._id,
      sessionId: data.sessionId,
      nameEnquiryReference: data.nameEnquiryReference,
      paymentReference: data.paymentReference,
      
      // Account details
      creditAccountName: data.creditAccountName,
      creditAccountNumber: data.creditAccountNumber,
      debitAccountName: data.debitAccountName,
      debitAccountNumber: data.debitAccountNumber,
      
      // Provider details
      provider: data.provider,
      providerChannel: data.providerChannel,
      providerChannelCode: data.providerChannelCode,
      destinationInstitutionCode: data.destinationInstitutionCode,
      
      // Transaction details
      narration: data.narration,
      amount: data.amount,
      fees: data.fees,
      vat: data.vat,
      stampDuty: data.stampDuty,
      netAmount: data.amount - data.fees - data.vat - data.stampDuty,
      
      // Response details
      responseCode: data.responseCode,
      responseMessage: data.responseMessage,
      
      // Reversal info
      isReversed: data.isReversed,
      reversalReference: data.reversalReference,
      
      // Timestamps
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      approvedAt: data.approvedAt,
      declinedAt: data.declinedAt,
      
      // Full webhook data for debugging
      webhookReceivedAt: new Date(),
    };
  }

  /**
   * Determine if this is a wallet funding transaction
   */
  isWalletFunding(data: SafeHavenTransferWebhook["data"]): boolean {
    return data.type === "Inwards";
  }

  /**
   * Determine if this is a withdrawal transaction
   */
  isWithdrawal(data: SafeHavenTransferWebhook["data"]): boolean {
    return data.type === "Outwards";
  }

  /**
   * Optional: Validate webhook signature (if SafeHaven provides it in future)
   */
  // validateSignature(payload: string, signature: string, secret: string): boolean {
  //   const crypto = require("crypto");
  //   const hash = crypto
  //     .createHmac("sha256", secret)
  //     .update(payload)
  //     .digest("hex");
  //   return hash === signature;
  // }

  /**
   * Optional: Validate webhook IP (if you want to whitelist SafeHaven IPs)
   */
  // validateIP(ip: string): boolean {
  //   const allowedIPs = [
  //     "SAFEHAVEN_IP_1",
  //     "SAFEHAVEN_IP_2",
  //     // Add SafeHaven webhook IPs here
  //   ];
  //   return allowedIPs.includes(ip);
  // }
}