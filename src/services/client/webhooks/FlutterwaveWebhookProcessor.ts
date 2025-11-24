import crypto from "crypto";
import logger from "@/logger";
import { PROVIDERS } from "@/config";

/**
 * FLUTTERWAVE WEBHOOK PROCESSOR
 * 
 * Purpose: Parse and validate Flutterwave webhook payloads
 * Responsibilities:
 * - Validate webhook signatures (HMAC-SHA256)
 * - Validate payload structure
 * - Extract and normalize data
 * - Map provider statuses to standard statuses
 * - Return WebhookProcessResult
 * 
 * Supported Event Types:
 * - charge.completed (wallet funding via virtual account, card, mobile money)
 * - transfer.completed (withdrawal success/failure)
 */

export interface WebhookProcessResult {
  reference: string;              // YOUR internal reference
  providerReference: string;      // Flutterwave's reference
  providerTransactionId: string;  // Flutterwave's unique transaction ID
  status: "success" | "pending" | "failed" | "reversed";
  metadata: {
    eventType: string;            // Original event type from Flutterwave
    amount?: number;
    netAmount?: number;           // Amount after fees
    fees?: number;
    currency?: string;
    accountNumber?: string;       // For virtual account payments
    accountName?: string;
    bankName?: string;
    customerEmail?: string;
    customerName?: string;
    paymentMethod?: string;
    webhookReceivedAt: Date;
    // Flutterwave-specific fields
    flutterwaveId?: string;
    txRef?: string;
    flwRef?: string;
    transferId?: string;
    failureReason?: string;
  };
  token?: string;
}

export class FlutterwaveWebhookProcessor {
  private webhookSecret: string;

  constructor() {
    this.webhookSecret = PROVIDERS.FLUTTERWAVE.webhookSecret || "";
  }

  /**
   * Validate Flutterwave webhook signature
   * Flutterwave uses HMAC-SHA256 and sends hash in 'flutterwave-signature' header
   * 
   * @param payload - Raw request body as string
   * @param signature - Signature from header
   * @returns boolean
   */
  validateSignature(payload: string, signature: string): boolean {
    try {
      if (!this.webhookSecret) {
        logger.warn("Flutterwave webhook secret not configured");
        return false;
      }

      // Flutterwave uses HMAC-SHA256
      const hash = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(payload)
        .digest("hex");

      const isValid = hash === signature;

      if (!isValid) {
        logger.warn("Flutterwave webhook signature validation failed", {
          expected: hash.substring(0, 10) + "...",
          received: signature.substring(0, 10) + "...",
        });
      }

      return isValid;
    } catch (error: any) {
      logger.error("Error validating Flutterwave webhook signature", error);
      return false;
    }
  }

  /**
   * Validate webhook payload structure
   * 
   * @param payload - Webhook payload object
   * @returns boolean
   */
  validatePayload(payload: any): boolean {
    try {
      // Basic structure validation
      if (!payload || typeof payload !== "object") {
        logger.error("Flutterwave webhook: Invalid payload structure");
        return false;
      }

      // Check required fields
      if (!payload.id || !payload.type || !payload.data) {
        logger.error("Flutterwave webhook: Missing required fields", {
          hasId: !!payload.id,
          hasType: !!payload.type,
          hasData: !!payload.data,
        });
        return false;
      }

      // Validate event type
      const validEventTypes = ["charge.completed", "transfer.completed"];
      if (!validEventTypes.includes(payload.type)) {
        logger.warn("Flutterwave webhook: Unsupported event type", {
          type: payload.type,
        });
        return false;
      }

      return true;
    } catch (error: any) {
      logger.error("Error validating Flutterwave webhook payload", error);
      return false;
    }
  }

  /**
   * Process webhook payload
   * Main entry point for webhook processing
   * 
   * @param payload - Webhook payload object
   * @returns WebhookProcessResult
   */
  async process(payload: any): Promise<WebhookProcessResult> {
    try {
      const eventType = payload.type;

      logger.info(`Processing Flutterwave webhook: ${eventType}`, {
        webhookId: payload.id,
        dataId: payload.data?.id,
      });

      // Route to appropriate handler based on event type
      switch (eventType) {
        case "charge.completed":
          return this.processChargeCompleted(payload);

        case "transfer.completed":
          return this.processTransferCompleted(payload);

        default:
          logger.warn(`Unsupported Flutterwave event type: ${eventType}`);
          throw new Error(`Unsupported event type: ${eventType}`);
      }
    } catch (error: any) {
      logger.error("Error processing Flutterwave webhook", {
        error: error.message,
        payload,
      });
      throw error;
    }
  }

  /**
   * Process charge.completed event
   * Handles: Virtual account funding, card payments, mobile money
   * 
   * @param payload - Webhook payload
   * @returns WebhookProcessResult
   */
  private processChargeCompleted(payload: any): WebhookProcessResult {
    const data = payload.data;

    // Extract reference (tx_ref is YOUR reference)
    const reference = data.tx_ref || data.reference || "";
    const providerReference = data.flw_ref || data.reference || "";
    const providerTransactionId = data.id || "";

    // Map status
    const status = this.mapChargeStatus(data.status);

    // Extract amount and fees
    const amount = Number(data.amount) || 0;
    const fees = Number(data.app_fee) || 0;
    const netAmount = amount - fees;

    // Extract payment method details
    const paymentMethod = data.payment_type || data.payment_method?.type || "unknown";

    // Build metadata
    const metadata: WebhookProcessResult["metadata"] = {
      eventType: "charge.completed",
      amount,
      netAmount,
      fees,
      currency: data.currency || "NGN",
      customerEmail: data.customer?.email,
      customerName: data.customer?.name,
      paymentMethod,
      webhookReceivedAt: new Date(),
      flutterwaveId: data.id,
      txRef: data.tx_ref,
      flwRef: data.flw_ref,
    };

    // For virtual account payments, extract account details
    if (paymentMethod === "account" || paymentMethod === "bank_transfer") {
      metadata.accountNumber = data.account?.account_number;
      metadata.accountName = data.account?.account_name;
      metadata.bankName = data.account?.bank_name;
    }

    // If payment failed, extract failure reason
    if (status === "failed" && data.processor_response) {
      metadata.failureReason = data.processor_response.message || "Payment failed";
    }

    logger.info("Flutterwave charge.completed processed", {
      reference,
      status,
      amount,
      netAmount,
      paymentMethod,
    });

    return {
      reference,
      providerReference,
      providerTransactionId,
      status,
      metadata,
    };
  }

  /**
   * Process transfer.completed event
   * Handles: Withdrawal success/failure
   * 
   * @param payload - Webhook payload
   * @returns WebhookProcessResult
   */
  private processTransferCompleted(payload: any): WebhookProcessResult {
    const data = payload.data;

    // Extract reference (reference is YOUR reference for transfers)
    const reference = data.reference || "";
    const providerReference = data.reference || "";
    const providerTransactionId = data.id?.toString() || "";

    // Map status
    const status = this.mapTransferStatus(data.status);

    // Extract amount and fees
    const amount = Number(data.amount) || 0;
    const fees = Number(data.fee) || 0;
    const netAmount = amount + fees; // For withdrawals, fees are added

    // Build metadata
    const metadata: WebhookProcessResult["metadata"] = {
      eventType: "transfer.completed",
      amount,
      netAmount,
      fees,
      currency: data.currency || "NGN",
      accountNumber: data.account_number,
      accountName: data.full_name || data.beneficiary_name,
      bankName: data.bank_name,
      webhookReceivedAt: new Date(),
      flutterwaveId: data.id?.toString(),
      transferId: data.id?.toString(),
    };

    // If transfer failed, extract failure reason
    if (status === "failed") {
      metadata.failureReason = 
        data.complete_message || 
        data.status || 
        "Transfer failed";
    }

    logger.info("Flutterwave transfer.completed processed", {
      reference,
      status,
      amount,
      accountNumber: data.account_number,
    });

    return {
      reference,
      providerReference,
      providerTransactionId,
      status,
      metadata,
    };
  }

  /**
   * Map Flutterwave charge status to standard status
   * 
   * @param flutterwaveStatus - Status from Flutterwave
   * @returns Standard status
   */
  private mapChargeStatus(
    flutterwaveStatus: string
  ): "success" | "pending" | "failed" | "reversed" {
    const statusMap: Record<string, "success" | "pending" | "failed" | "reversed"> = {
      successful: "success",
      success: "success",
      completed: "success",
      failed: "failed",
      cancelled: "failed",
      pending: "pending",
      processing: "pending",
      reversed: "reversed",
    };

    const normalized = flutterwaveStatus?.toLowerCase() || "pending";
    return statusMap[normalized] || "pending";
  }

  /**
   * Map Flutterwave transfer status to standard status
   * 
   * @param flutterwaveStatus - Status from Flutterwave
   * @returns Standard status
   */
  private mapTransferStatus(
    flutterwaveStatus: string
  ): "success" | "pending" | "failed" | "reversed" {
    const statusMap: Record<string, "success" | "pending" | "failed" | "reversed"> = {
      successful: "success",
      success: "success",
      SUCCESSFUL: "success",
      failed: "failed",
      FAILED: "failed",
      pending: "pending",
      PENDING: "pending",
      NEW: "pending",
      reversed: "reversed",
      REVERSED: "reversed",
    };

    return statusMap[flutterwaveStatus] || "pending";
  }

  /**
   * Validate webhook IP (optional)
   * Flutterwave doesn't publish official IPs, so this is disabled by default
   * 
   * @param ip - Client IP address
   * @returns boolean
   */
  validateIP(ip: string): boolean {
    // Flutterwave doesn't publish webhook IPs
    // If you get official IPs, add them here
    const allowedIPs: string[] = [
      // "FLUTTERWAVE_IP_1",
      // "FLUTTERWAVE_IP_2",
      "127.0.0.1", // Localhost for testing
      "::1", // IPv6 localhost
    ];

    // If no IPs configured, skip validation
    if (allowedIPs.length === 2) {
      return true;
    }

    return allowedIPs.includes(ip);
  }
}