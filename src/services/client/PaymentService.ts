import { Payment } from "@/models/wallet/Payment";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { generateReference } from "@/utils/helpers";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { FlutterwaveService } from "./FlutterwaveService";
import logger from "@/logger";
import { User } from "@/models/core/User";
import { PaystackService } from "./PaystackService";
import { SaveHavenService } from "@/controllers/client/SaveHaven";
import { MonnifyService } from "./MonifyService";

export interface InitializePaymentDTO {
  userId: string;
  amount: number;
  provider?: "paystack" | "monify" | "flutterwave" | "saveHaven";
  meta?: any;
}

export interface ProcessWithdrawalDTO {
  withdrawalId: string;
  userId: string;
  amount: number;
  accountNumber: string;
  accountName: string;
  bankCode: string ;
  bankName: string;
  reference: string;
  provider?: "paystack" | "flutterwave" | "saveHaven" | "monify";
}

export class PaymentService {
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private flutterwaveService: FlutterwaveService;
  private paystackService: PaystackService;
  private saveHavenService: SaveHavenService;
  private monifyService: MonnifyService;
  constructor() {
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.flutterwaveService = new FlutterwaveService();
    this.paystackService = new PaystackService();
    this.saveHavenService = new SaveHavenService();
    this.monifyService = new MonnifyService();
  }

  // payment.service.ts
  async initializePayment(data: InitializePaymentDTO): Promise<any> {
    const reference = generateReference("PAY");

    console.log(data);

    // Create payment record first
    const payment = await Payment.create({
      userId: data.userId,
      reference,
      amount: data.amount,
      status: "pending",
      meta: data.meta,
    });

    console.log(payment);

    // Get user details for virtual account creation
    const user = await User.findById(data.userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
    }

    if (!user.bvn) {
      throw new AppError("Bvn is required", 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Select provider service (default to flutterwave)
    const provider = data.provider || "flutterwave";
    let virtualAccountData;

    try {
      switch (provider) {
        case "flutterwave":
          virtualAccountData =
            await this.flutterwaveService.createVirtualAccount({
              email: user.email,
              is_permanent: false,
              bvn: user.bvn || "", // You might need to handle BVN validation
              tx_ref: reference,
              amount: data.amount,
              firstname: user.firstname,
              lastname: user.lastname,
              narration: `Wallet funding - ${reference}`,
            });

          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              "meta.virtualAccount": {
                accountNumber: virtualAccountData.account_number,
                bankName: virtualAccountData.bank_name,
                accountName: virtualAccountData.account_name,
                provider: provider,
                orderReference: virtualAccountData.order_ref,
                providerReference: virtualAccountData.flw_ref,
                expiresAt:
                  virtualAccountData.expires_at ||
                  new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
              },
            },
          });
          break;

        case "paystack":
          virtualAccountData = await this.paystackService.createVirtualAccount({
            email: user.email,
            reference: reference,
            amount: data.amount,
            firstname: user.firstname,
            lastname: user.lastname,
          });
          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              "meta.virtualAccount": {
                accountNumber: virtualAccountData.account_number,
                bankName: virtualAccountData.bank_name,
                accountName: virtualAccountData.account_name,
                provider: provider,
                expiresAt:
                  virtualAccountData.expires_at ||
                  new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
              },
            },
          });
          break;

        // case "monify":
        //   virtualAccountData = await this.monifyService.createVirtualAccount({
        //     email: user.email,
        //     reference: reference,
        //     amount: data.amount,
        //     firstname: user.firstname,
        //     lastname: user.lastname,
        //   });
        //   break;

        case "saveHaven":
          virtualAccountData = await this.saveHavenService.createVirtualAccount(
            {
              email: user.email,
              reference: reference,
              amount: data.amount,
              firstname: user.firstname,
              lastname: user.lastname,
            }
          );
          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              "meta.virtualAccount": {
                accountNumber: virtualAccountData.account_number,
                bankName: virtualAccountData.bank_name,
                accountName: virtualAccountData.account_name,
                provider: provider,
                expiresAt:
                  virtualAccountData.expires_at ||
                  new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
              },
            },
          });
          break;

        default:
          throw new AppError(
            "Invalid payment provider",
            400,
            ERROR_CODES.INVALID_PROVIDER
          );
      }

      console.log(payment, "updated");

      return {
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        virtualAccount: {
          accountNumber: virtualAccountData.account_number,
          bankName: virtualAccountData.bank_name,
          accountName: virtualAccountData.account_name,
          expiresAt: virtualAccountData.expires_at,
        },
      };
    } catch (error: any) {
      // Update payment status to failed if virtual account creation fails
      await Payment.findByIdAndUpdate(payment._id, {
        $set: { status: "failed" },
      });

      logger.error(`Failed to create virtual account for ${reference}:`, error);
      throw new AppError(
        error.message || "Failed to generate payment account",
        400,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  async verifyPayment(reference: string): Promise<any> {
    const payment = await Payment.findOne({ reference });
    if (!payment) {
      throw new AppError(
        "Payment not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const result = this.flutterwaveService.verifyPayment(reference);

    if (!result) {
      throw new AppError(
        "Payment verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    payment.status = "success";
    payment.amountPaid = payment.amount;
    await payment.save();

    // Credit user wallet
    await this.walletService.creditWallet(
      payment.userId,
      payment.amount,
      `Wallet funding via ${reference}`
    );

    // Send notification
    await this.notificationRepository.create({
      type: "payment_success",
      notifiableType: "User",
      notifiableId: payment.userId,
      data: {
        transactionType: "Wallet Funding",
        amount: payment.amount,
        reference: payment.reference,
      },
    });

    return {
      reference: payment.reference,
      amount: payment.amount,
      status: payment.status,
    };
  }

  async processWithdrawal(data: ProcessWithdrawalDTO): Promise<any> {
    const provider = data.provider || "flutterwave";

    // Get user details
    const user = await User.findById(data.userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
    }

    // Create payment record for withdrawal
    const payment = await Payment.create({
      userId: data.userId,
      reference: data.reference,
      amount: data.amount,
      status: "pending",
      type: "withdrawal",
      meta: {
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bankCode: data.bankCode,
        bankName: data.bankName,
        withdrawalId: data.withdrawalId,
        provider: provider,
      },
    });

    try {
      let transferResponse;

      switch (provider) {
        case "flutterwave":
          transferResponse = await this.flutterwaveService.initiateTransfer({
            account_number: data.accountNumber,
            account_bank: data.bankCode,
            amount: data.amount,
            narration: `Withdrawal - ${data.reference}`,
            currency: "NGN",
            reference: data.reference,
            callback_url: `${process.env.BASE_URL}/api/webhooks/flutterwave/transfer`,
            debit_currency: "NGN",
            beneficiary_name: data.accountName,
          });

          // Update payment with transfer details
          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              status: "processing",
              "meta.transferId": transferResponse.id,
              "meta.transferStatus": transferResponse.status,
              "meta.providerReference": transferResponse.reference,
            },
          });

          break;

        case "paystack":
          transferResponse = await this.paystackService.initiateTransfer({
            source: "balance",
            amount: data.amount * 100, // Paystack uses kobo
            recipient: data.accountNumber,
            reason: `Withdrawal - ${data.reference}`,
            reference: data.reference,
          });

          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              status: "processing",
              "meta.transferId": transferResponse.id,
              "meta.transferCode": transferResponse.transfer_code,
              "meta.providerReference": transferResponse.reference,
            },
          });

          break;

        case "saveHaven":
          transferResponse = await this.saveHavenService.initiateTransfer({
            account_number: data.accountNumber,
            account_bank: data.bankCode,
            amount: data.amount,
            narration: `Withdrawal - ${data.reference}`,
            reference: data.reference,
            beneficiary_name: data.accountName,
          });

          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              status: "processing",
              "meta.transferId": transferResponse.id,
              "meta.transferStatus": transferResponse.status,
              "meta.providerReference": transferResponse.reference,
            },
          });

          break;

        // case "monify":
        //   transferResponse = await this.monifyService.initiateTransfer({
        //     account_number: data.accountNumber,
        //     account_bank: data.bankCode,
        //     amount: data.amount,
        //     narration: `Withdrawal - ${data.reference}`,
        //     reference: data.reference,
        //     beneficiary_name: data.accountName,
        //   });

        //   await Payment.findByIdAndUpdate(payment._id, {
        //     $set: {
        //       status: "processing",
        //       "meta.transferId": transferResponse.transactionReference,
        //       "meta.transferStatus": transferResponse.status,
        //     },
        //   });

        //   break;

        default:
          throw new AppError(
            "Invalid payment provider",
            400,
            ERROR_CODES.INVALID_PROVIDER
          );
      }

      logger.info(`Withdrawal initiated for ${data.reference} via ${provider}`);

      return {
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        provider: provider,
        transferId:
          transferResponse?.id || transferResponse?.transactionReference,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bankName: data.bankName,
      };
    } catch (error: any) {
      // Update payment status to failed
      await Payment.findByIdAndUpdate(payment._id, {
        $set: {
          status: "failed",
          "meta.error": error.message,
        },
      });

      logger.error(
        `Failed to process withdrawal for ${data.reference}:`,
        error
      );

      throw new AppError(
        error.message || "Failed to process withdrawal",
        400,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  /**
   * Verify withdrawal status from provider
   * @param reference - Payment reference
   * @returns Withdrawal status
   */
  async verifyWithdrawal(reference: string): Promise<any> {
    const payment = await Payment.findOne({ reference, type: "withdrawal" });
    if (!payment) {
      throw new AppError(
        "Withdrawal not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const provider = payment.meta?.provider || "flutterwave";
    let verificationResult;

    try {
      switch (provider) {
        case "flutterwave":
          verificationResult = await this.flutterwaveService.verifyPayment(
            payment.meta.transferId
          );
          break;

        case "paystack":
          verificationResult = await this.paystackService.verifyPayment(
            payment.meta.transferId
          );
          break;

        case "saveHaven":
          verificationResult = await this.saveHavenService.verifyPayment(
            payment.meta.transferId
          );
          break;

        case "monify":
          verificationResult = await this.monifyService.verifyPayment(
            payment.meta.transferId
          );
          break;

        default:
          throw new AppError(
            "Invalid payment provider",
            400,
            ERROR_CODES.INVALID_PROVIDER
          );
      }

      // Update payment status based on verification
      const status = this.mapProviderStatus(
        verificationResult.status,
        provider
      );

      await Payment.findByIdAndUpdate(payment._id, {
        $set: {
          status: status,
          "meta.verificationResult": verificationResult,
        },
      });

      return {
        reference: payment.reference,
        amount: payment.amount,
        status: status,
        provider: provider,
        providerStatus: verificationResult.status,
      };
    } catch (error: any) {
      logger.error(`Failed to verify withdrawal for ${reference}:`, error);
      throw new AppError(
        error.message || "Failed to verify withdrawal",
        400,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  /**
   * Map provider-specific status to standard status
   * @param providerStatus - Status from payment provider
   * @param provider - Payment provider name
   * @returns Standardized status
   */
  private mapProviderStatus(providerStatus: string, provider: string): string {
    const statusMap: Record<string, Record<string, string>> = {
      flutterwave: {
        SUCCESSFUL: "success",
        FAILED: "failed",
        PENDING: "processing",
      },
      paystack: {
        success: "success",
        failed: "failed",
        pending: "processing",
      },
      saveHaven: {
        successful: "success",
        failed: "failed",
        pending: "processing",
      },
      monify: {
        SUCCESS: "success",
        FAILED: "failed",
        PENDING: "processing",
      },
    };

    return statusMap[provider]?.[providerStatus] || "pending";
  }
}
