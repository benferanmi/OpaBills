import { Request, Response, NextFunction } from "express";
import { WebhookService } from "@/services/WebhookService";
import { sendSuccessResponse } from "@/utils/helpers";
import logger from "@/logger";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { VTPassService } from "@/services/client/providers/VtpassService";
import { SafeHavenWebhookProcessor } from "@/services/client/webhooks/SafeHavenWebhookProcessor";
import { MonnifyWebhookProcessor } from "@/services/client/webhooks/MonnifyWebhookProcessor";
import { MonnifyWebhookService } from "@/services/client/webhooks/MonnifyWebhookService";
import { FlutterwaveWebhookProcessor } from "@/services/client/webhooks/FlutterwaveWebhookProcessor";
import { FlutterwaveWebhookService } from "@/services/client/webhooks/FlutterwaveWebhookService";
import { SaveHavenWebhookService } from "@/services/client/webhooks/SaveHavenWebhookService";

// Routes to appropriate processor → WebhookService
export class WebhookController {
  private webhookService: WebhookService;
  private vtpassService: VTPassService;
  private saveHavenProcessor: SafeHavenWebhookProcessor;
  private saveHavenService: SaveHavenWebhookService;
  private monnifyProcessor: MonnifyWebhookProcessor;
  private monnifyService: MonnifyWebhookService;
  private flutterwaveProcessor: FlutterwaveWebhookProcessor;
  private flutterwaveService: FlutterwaveWebhookService;

  constructor() {
    this.webhookService = new WebhookService();
    this.vtpassService = new VTPassService();
    this.saveHavenProcessor = new SafeHavenWebhookProcessor();
    this.saveHavenService = new SaveHavenWebhookService();
    this.monnifyProcessor = new MonnifyWebhookProcessor();
    this.monnifyService = new MonnifyWebhookService();
    this.flutterwaveProcessor = new FlutterwaveWebhookProcessor();
    this.flutterwaveService = new FlutterwaveWebhookService();
  }

  // Handle VTPass webhook callbacks
  handleVTPassWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      logger.info("VTPass webhook endpoint hit", {
        body: req.body,
        ip: req.ip,
      });

      // Optional: Validate webhook IP
      // const clientIP = req.ip || req.connection.remoteAddress;
      // if (!this.vtpassProcessor.validateIP(clientIP)) {
      //   logger.warn("VTPass webhook from unauthorized IP", { ip: clientIP });
      //   throw new AppError(
      //     "Unauthorized",
      //     HTTP_STATUS.UNAUTHORIZED,
      //     ERROR_CODES.UNAUTHORIZED
      //   );
      // }

      // Optional: Validate webhook signature
      // const signature = req.headers["x-vtpass-signature"] as string;
      // const secret = process.env.VTPASS_WEBHOOK_SECRET || "";
      // if (!this.vtpassProcessor.validateSignature(JSON.stringify(req.body), signature, secret)) {
      //   logger.warn("VTPass webhook invalid signature");
      //   throw new AppError(
      //     "Invalid signature",
      //     HTTP_STATUS.UNAUTHORIZED,
      //     ERROR_CODES.UNAUTHORIZED
      //   );
      // }

      // Process webhook through VTPass processor
      const webhookData = await this.vtpassService.process(req.body);

      // Pass to unified webhook service
      await this.webhookService.processWebhook("VTPass", webhookData);

      return res.status(HTTP_STATUS.OK).json({
        response: "success",
      });
    } catch (error) {
      logger.error("VTPass webhook processing error", error);

      return res.status(HTTP_STATUS.OK).json({
        response: "success",
      });

      // Alternative: If you want to return errors to VTPass
      // next(error);
    }
  };

  // Flow: SafeHaven → Controller → saveHavenProcessor → safeHavenService
  handleSafeHavenWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      logger.info("SafeHaven webhook endpoint hit", {
        body: req.body,
        ip: req.ip,
        type: req.body?.type,
        transactionId: req.body?.data?._id,
      });

      // Optional: Validate webhook IP
      // const clientIP = req.ip || req.connection.remoteAddress;
      // if (!this.saveHavenProcessor.validateIP(clientIP)) {
      //   logger.warn("SafeHaven webhook from unauthorized IP", { ip: clientIP });
      //   throw new AppError(
      //     "Unauthorized",
      //     HTTP_STATUS.UNAUTHORIZED,
      //     ERROR_CODES.UNAUTHORIZED
      //   );
      // }

      // Optional: Validate webhook signature
      // const signature = req.headers["x-safehaven-signature"] as string;
      // const secret = process.env.SAFEHAVEN_WEBHOOK_SECRET || "";
      // if (!this.saveHavenProcessor.validateSignature(JSON.stringify(req.body), signature, secret)) {
      //   logger.warn("SafeHaven webhook invalid signature");
      //   throw new AppError(
      //     "Invalid signature",
      //     HTTP_STATUS.UNAUTHORIZED,
      //     ERROR_CODES.UNAUTHORIZED
      //   );
      // }

      // Validate payload structure
      if (!this.saveHavenProcessor.validatePayload(req.body)) {
        logger.error("SafeHaven webhook: Invalid payload structure", {
          body: req.body,
        });
        // Still return success to prevent retries
        return res.status(HTTP_STATUS.OK).json({ status: "success" });
      }

      // Process webhook through SafeHaven processor
      const webhookData = await this.saveHavenProcessor.process(req.body);

      // Pass to SafeHaven-specific webhook service
      await this.saveHavenService.processWebhook(webhookData);

      logger.info("SafeHaven webhook processed successfully", {
        transactionId: req.body?.data?._id,
        type: req.body?.type,
        status: webhookData.status,
      });

      // Return 200 OK to acknowledge receipt
      return res.status(HTTP_STATUS.OK).json({ status: "success" });
    } catch (error: any) {
      logger.error("SafeHaven webhook processing error", {
        error: error.message,
        stack: error.stack,
        body: req.body,
      });

      // Return 200 to prevent SafeHaven from retrying
      // Log the error but acknowledge receipt
      return res.status(HTTP_STATUS.OK).json({ status: "success" });

      // Alternative: If you want to return errors to SafeHaven
      // next(error);
    }
  };

  /**
   * Handle Monnify webhook callbacks
   * Flow: Monnify → Controller → monnifyProcessor → monnifyService
   *
   * Supported Event Types:
   * - SUCCESSFUL_TRANSACTION (wallet funding)
   * - SUCCESSFUL_DISBURSEMENT (withdrawal success)
   * - FAILED_DISBURSEMENT (withdrawal failed)
   * - REVERSED_DISBURSEMENT (withdrawal reversed)
   */
  handleMonnifyWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      logger.info("Monnify webhook endpoint hit", {
        body: req.body,
        ip: req.ip,
        eventType: req.body?.eventType,
        reference:
          req.body?.eventType === "SUCCESSFUL_TRANSACTION"
            ? req.body?.eventData?.product?.reference
            : req.body?.eventData?.reference,
      });

      // ===
      // STEP 1: Validate Webhook IP (Optional but Recommended)
      // Monnify webhook IP: 35.242.133.146
      // ===
      const clientIP = req.ip || req.connection.remoteAddress;
      if (process.env.MONNIFY_VALIDATE_IP === "true") {
        if (!this.monnifyProcessor.validateIP(clientIP || "")) {
          logger.warn("Monnify webhook from unauthorized IP", {
            ip: clientIP,
          });
          // Still return success to prevent retries
          return res.status(HTTP_STATUS.OK).json({ status: "success" });
        }
      }

      // ===
      // STEP 2: Validate Webhook Signature (CRITICAL)
      // Monnify sends HMAC-SHA512 hash in 'monnify-signature' header
      // ===
      const signature = req.headers["monnify-signature"] as string;
      const requestBody = JSON.stringify(req.body);

      if (process.env.MONNIFY_VALIDATE_SIGNATURE !== "false") {
        if (!signature) {
          logger.warn("Monnify webhook: Missing signature header");
          return res.status(HTTP_STATUS.OK).json({ status: "success" });
        }

        const isValidSignature = this.monnifyProcessor.validateSignature(
          requestBody,
          signature
        );

        if (!isValidSignature) {
          logger.error("Monnify webhook: Invalid signature", {
            signature,
            body: req.body,
          });
          // Still return success to prevent retries
          return res.status(HTTP_STATUS.OK).json({ status: "success" });
        }

        logger.info("Monnify webhook: Signature validated successfully");
      }

      // ===
      // STEP 3: Validate Payload Structure
      // ===
      if (!this.monnifyProcessor.validatePayload(req.body)) {
        logger.error("Monnify webhook: Invalid payload structure", {
          body: req.body,
        });
        // Still return success to prevent retries
        return res.status(HTTP_STATUS.OK).json({ status: "success" });
      }

      // ===
      // STEP 4: Process Webhook through Monnify Processor
      // ===
      const webhookData = await this.monnifyProcessor.process(req.body);

      // ===
      // STEP 5: Pass to Monnify-Specific Webhook Service
      // ===
      await this.monnifyService.processWebhook(webhookData);

      logger.info("Monnify webhook processed successfully", {
        eventType: req.body?.eventType,
        reference: webhookData.reference,
        status: webhookData.status,
      });

      // ===
      // STEP 6: Return 200 OK to Acknowledge Receipt
      // Monnify expects 200 status code to prevent retries
      // ===
      return res.status(HTTP_STATUS.OK).json({ status: "success" });
    } catch (error: any) {
      logger.error("Monnify webhook processing error", {
        error: error.message,
        stack: error.stack,
        body: req.body,
      });

      // Return 200 to prevent Monnify from retrying
      // Log the error but acknowledge receipt
      return res.status(HTTP_STATUS.OK).json({ status: "success" });

      // Alternative: If you want to return errors to Monnify
      // next(error);
    }
  };

  /**
   * Handle Flutterwave webhook callbacks
   * Flow: Flutterwave → Controller → flutterwaveProcessor → flutterwaveService
   *
   * Supported Event Types:
   * - charge.completed (wallet funding via virtual account, card, mobile money)
   * - transfer.completed (withdrawal success/failure)
   *
   * Security:
   * - Validates signature using HMAC-SHA256
   * - Signature sent in 'flutterwave-signature' header
   */
  handleFlutterwaveWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    try {
      logger.info("Flutterwave webhook endpoint hit", {
        body: req.body,
        ip: req.ip,
        eventType: req.body?.type,
        webhookId: req.body?.id,
        transactionId: req.body?.data?.id,
      });

      // ===
      // STEP 1: Validate Webhook IP (Optional)
      // Flutterwave doesn't publish official IPs
      // Skip IP validation unless you have specific IPs
      // ===
      // const clientIP = req.ip || req.connection.remoteAddress;
      // if (process.env.FLUTTERWAVE_VALIDATE_IP === "true") {
      //   if (!this.flutterwaveProcessor.validateIP(clientIP || "")) {
      //     logger.warn("Flutterwave webhook from unauthorized IP", {
      //       ip: clientIP,
      //     });
      //     return res.status(HTTP_STATUS.OK).json({ status: "success" });
      //   }
      // }

      // ===
      // STEP 2: Validate Webhook Signature (CRITICAL)
      // Flutterwave sends HMAC-SHA256 hash in 'flutterwave-signature' header
      // ===
      const signature = req.headers["flutterwave-signature"] as string;
      const requestBody = JSON.stringify(req.body);

      if (process.env.FLUTTERWAVE_VALIDATE_SIGNATURE !== "false") {
        if (!signature) {
          logger.warn("Flutterwave webhook: Missing signature header");
          return res.status(HTTP_STATUS.OK).json({ status: "success" });
        }

        const isValidSignature = this.flutterwaveProcessor.validateSignature(
          requestBody,
          signature
        );

        if (!isValidSignature) {
          logger.error("Flutterwave webhook: Invalid signature", {
            signature: signature.substring(0, 10) + "...",
            body: req.body,
          });
          // Still return success to prevent retries
          return res.status(HTTP_STATUS.OK).json({ status: "success" });
        }

        logger.info("Flutterwave webhook: Signature validated successfully");
      }

      // ===
      // STEP 3: Validate Payload Structure
      // ===
      if (!this.flutterwaveProcessor.validatePayload(req.body)) {
        logger.error("Flutterwave webhook: Invalid payload structure", {
          body: req.body,
        });
        // Still return success to prevent retries
        return res.status(HTTP_STATUS.OK).json({ status: "success" });
      }

      // ===
      // STEP 4: Process Webhook through Flutterwave Processor
      // ===
      const webhookData = await this.flutterwaveProcessor.process(req.body);

      // ===
      // STEP 5: Pass to Flutterwave-Specific Webhook Service
      // ===
      await this.flutterwaveService.processWebhook(webhookData);

      logger.info("Flutterwave webhook processed successfully", {
        eventType: req.body?.type,
        reference: webhookData.reference,
        status: webhookData.status,
        transactionId: webhookData.providerTransactionId,
      });

      // ===
      // STEP 6: Return 200 OK to Acknowledge Receipt
      // Flutterwave expects 200 status code to prevent retries
      // ===
      return res.status(HTTP_STATUS.OK).json({ status: "success" });
    } catch (error: any) {
      logger.error("Flutterwave webhook processing error", {
        error: error.message,
        stack: error.stack,
        body: req.body,
      });

      // Return 200 to prevent Flutterwave from retrying
      // Log the error but acknowledge receipt
      return res.status(HTTP_STATUS.OK).json({ status: "success" });

      // Alternative: If you want to return errors to Flutterwave
      // next(error);
    }
  };

  // TODO: Add other provider webhook handlers below
  // Each will follow the same pattern: Processor → WebhookService

  // handleClubKonnectWebhook = async (
  //   req: Request,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     logger.info("ClubKonnect webhook endpoint hit", { body: req.body });
  //
  //     const webhookData = await this.clubkonnectProcessor.process(req.body);
  //     await this.webhookService.processWebhook("ClubKonnect", webhookData);
  //
  //     return sendSuccessResponse(res, null, "Webhook processed", HTTP_STATUS.OK);
  //   } catch (error) {
  //     logger.error("ClubKonnect webhook error", error);
  //     return sendSuccessResponse(res, null, "Webhook received", HTTP_STATUS.OK);
  //   }
  // };

  // handleCoolSubWebhook = async (
  //   req: Request,
  //   res: Response,
  //   next: NextFunction
  // ) => {
  //   try {
  //     logger.info("CoolSub webhook endpoint hit", { body: req.body });
  //
  //     const webhookData = await this.coolsubProcessor.process(req.body);
  //     await this.webhookService.processWebhook("CoolSub", webhookData);
  //
  //     return sendSuccessResponse(res, null, "Webhook processed", HTTP_STATUS.OK);
  //   } catch (error) {
  //     logger.error("CoolSub webhook error", error);
  //     return sendSuccessResponse(res, null, "Webhook received", HTTP_STATUS.OK);
  //   }
  // };

  // Add more providers as needed...
}
