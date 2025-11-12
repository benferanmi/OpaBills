import { Payment } from "@/models/wallet/Payment";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { generateReference } from "@/utils/helpers";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { User } from "@/models/core/User";
import { SaveHavenService } from "@/services/client/SaveHavenService";
import { MonnifyService } from "./MonnifyService";
import { FlutterwaveService } from "./FlutterwaveService";

export interface InitializePaymentDTO {
  userId: string;
  amount: number;
  method?: string;
  provider?: "monnify" | "saveHaven" | "flutterwave";
}

export interface ProcessWithdrawalDTO {
  withdrawalId: string;
  userId: string;
  amount: number;
  accountNumber: string;
  accountName: string;
  bankCode: string;
  bankName: string;
  reference: string;
  provider?: "saveHaven" | "monnify" | "flutterwave";
}

export class PaymentService {
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private saveHavenService: SaveHavenService;
  private monnifyService: MonnifyService;
  private flutterwaveService: FlutterwaveService;

  constructor() {
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.saveHavenService = new SaveHavenService();
    this.monnifyService = new MonnifyService();
    this.flutterwaveService = new FlutterwaveService();
  }

  async initializePayment(data: InitializePaymentDTO): Promise<any> {
    const reference = generateReference("PAY");
    const provider = data.provider || "flutterwave";

    // Get user details for virtual account creation
    const user = await User.findById(data.userId);
    if (!user) {
      throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
    }

    if (!user.bvn) {
      throw new AppError("BVN is required", 400, ERROR_CODES.VALIDATION_ERROR);
    }

    // Create payment record first
    const payment = await Payment.create({
      userId: data.userId,
      reference,
      amount: data.amount,
      type: "deposit",
      status: "pending",
      meta: {
        provider: provider,
      },
    });

    let virtualAccountData;

    try {
      switch (provider) {
        case "monnify":
          const monnifyAccount = await this.monnifyService.createVirtualAccount(
            {
              email: user.email,
              reference: reference,
              firstname: user.firstname,
              lastname: user.lastname,
              bvn: user.bvn,
            }
          );

          // Monnify returns multiple accounts, pick the first one
          const primaryAccount = monnifyAccount.accounts[0];

          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              "meta.virtualAccount": {
                accountNumber: primaryAccount.accountNumber,
                bankName: primaryAccount.bankName,
                accountName: monnifyAccount.accountName,
                provider: provider,
                providerReference: monnifyAccount.accountReference,
              },
            },
          });

          virtualAccountData = {
            account_number: primaryAccount.accountNumber,
            bank_name: primaryAccount.bankName,
            account_name: monnifyAccount.accountName,
            accounts: monnifyAccount.accounts, // Return all available accounts
          };
          break;

        case "flutterwave":
          const flutterwaveAccount =
            await this.flutterwaveService.createVirtualAccount({
              email: user.email,
              firstname: user.firstname,
              lastname: user.lastname,
              reference: reference,
              bvn: user.bvn,
              phone: user.phone,
              isPermanent: false,
              amount: data.amount,
            });

          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              "meta.virtualAccount": {
                accountNumber: flutterwaveAccount.account_number,
                bankName: flutterwaveAccount.bank_name,
                accountName: flutterwaveAccount.account_name,
                provider: provider,
                orderReference: flutterwaveAccount.account_reference,
                expiresAt: flutterwaveAccount.expiry_date
                  ? new Date(flutterwaveAccount.expiry_date)
                  : new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            },
          });

          virtualAccountData = {
            account_number: flutterwaveAccount.account_number,
            bank_name: flutterwaveAccount.bank_name,
            account_name: flutterwaveAccount.account_name,
            expires_at: flutterwaveAccount.expiry_date,
          };
          break;

        case "saveHaven":
          const saveHavenAccount =
            await this.saveHavenService.createVirtualAccount({
              email: user.email,
              firstname: user.firstname,
              amount: data.amount,
              lastname: user.lastname,
              reference: reference,
              phone: user.phone,
              bvn: user.bvn,
            });

          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              "meta.virtualAccount": {
                accountNumber: saveHavenAccount.account_number,
                bankName: saveHavenAccount.bank_name,
                accountName: saveHavenAccount.account_name,
                provider: provider,
                expiresAt:
                  saveHavenAccount.expires_at ||
                  new Date(Date.now() + 24 * 60 * 60 * 1000),
              },
            },
          });

          virtualAccountData = {
            account_number: saveHavenAccount.account_number,
            bank_name: saveHavenAccount.bank_name,
            account_name: saveHavenAccount.account_name,
            expires_at: saveHavenAccount.expires_at,
          };
          break;

        default:
          throw new AppError(
            "Invalid payment provider",
            400,
            ERROR_CODES.INVALID_PROVIDER
          );
      }

      logger.info(
        `Created virtual account for ${reference} via ${provider}`,
        virtualAccountData
      );

      return {
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        provider: provider,
        virtualAccount: {
          accountNumber: virtualAccountData.account_number,
          bankName: virtualAccountData.bank_name,
          accountName: virtualAccountData.account_name,
          expiresAt: virtualAccountData.expires_at,
          accounts: virtualAccountData.accounts,
        },
      };
    } catch (error: any) {
      // Update payment status to failed if virtual account creation fails
      await Payment.findByIdAndUpdate(payment._id, {
        $set: {
          status: "failed",
          "meta.error": error.message,
        },
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
    const payment = await Payment.findOne({ reference, type: "deposit" });
    if (!payment) {
      throw new AppError(
        "Payment not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    // If already successful, return current status
    if (payment.status === "success") {
      return {
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
      };
    }

    const provider = payment.meta?.provider || "saveHaven";
    let verificationResult;

    try {
      switch (provider) {
        case "monnify":
          verificationResult = await this.monnifyService.verifyPayment(
            reference
          );

          // Map Monnify status
          if (
            verificationResult.paymentStatus === "PAID" &&
            verificationResult.settlementAmount >= payment.amount
          ) {
            payment.status = "success";
            payment.amountPaid = verificationResult.settlementAmount;
          } else {
            throw new AppError(
              "Payment not confirmed",
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR
            );
          }
          break;

        case "flutterwave":
          // For Flutterwave, we need the transaction ID
          // This should come from webhook or can be queried by reference
          const txRef =
            payment.meta?.virtualAccount?.orderReference || reference;
          verificationResult = await this.flutterwaveService.verifyTransaction(
            txRef
          );

          // Map Flutterwave status
          if (
            verificationResult.status === "successful" &&
            verificationResult.amount >= payment.amount
          ) {
            payment.status = "success";
            payment.amountPaid = verificationResult.amount;
          } else {
            throw new AppError(
              "Payment not confirmed",
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR
            );
          }
          break;

        case "saveHaven":
          verificationResult = await this.saveHavenService.verifyPayment(
            reference
          );

          if (!verificationResult) {
            throw new AppError(
              "Payment verification failed",
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR
            );
          }

          payment.status = "success";
          payment.amountPaid = payment.amount;
          break;

        default:
          throw new AppError(
            "Invalid payment provider",
            400,
            ERROR_CODES.INVALID_PROVIDER
          );
      }

      payment.meta.verificationData = verificationResult;
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
          provider: provider,
        },
      });

      logger.info(
        `Payment verified successfully: ${reference} via ${provider}`
      );

      return {
        reference: payment.reference,
        amount: payment.amount,
        status: payment.status,
        provider: provider,
      };
    } catch (error: any) {
      logger.error(`Failed to verify payment for ${reference}:`, error);
      throw new AppError(
        error.message || "Payment verification failed",
        error.statusCode || HTTP_STATUS.BAD_REQUEST,
        error.errorCode || ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  async processWithdrawal(data: ProcessWithdrawalDTO): Promise<any> {
    const provider = data.provider || "saveHaven";

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
      type: "withdrawal",
      status: "pending",
      meta: {
        provider: provider,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        bankCode: data.bankCode,
        bankName: data.bankName,
        withdrawalId: data.withdrawalId,
      },
    });

    try {
      let transferResponse;

      switch (provider) {
        case "monnify":
          transferResponse = await this.monnifyService.initiateTransfer({
            amount: data.amount,
            destinationBankCode: data.bankCode,
            destinationAccountNumber: data.accountNumber,
            narration: `Withdrawal - ${data.reference}`,
            reference: data.reference,
          });

          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              status: "processing",
              "meta.transferId": transferResponse.reference,
              "meta.transferStatus": transferResponse.status,
              "meta.providerReference": transferResponse.transactionReference,
            },
          });

          break;

        case "flutterwave":
          transferResponse = await this.flutterwaveService.initiateTransfer({
            accountBank: data.bankCode,
            accountNumber: data.accountNumber,
            amount: data.amount,
            narration: `Withdrawal - ${data.reference}`,
            reference: data.reference,
            beneficiaryName: data.accountName,
          });

          await Payment.findByIdAndUpdate(payment._id, {
            $set: {
              status: "processing",
              "meta.transferId": transferResponse.id.toString(),
              "meta.transferStatus": transferResponse.status,
              "meta.providerReference": transferResponse.reference,
            },
          });

          break;

        case "saveHaven":
          transferResponse = await this.saveHavenService.initiateTransfer({
            account_number: data.accountNumber,
            bank_code: data.bankCode,
            amount: data.amount,
            narration: `Withdrawal - ${data.reference}`,
            reference: data.reference,
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
        transferId: payment.meta.transferId,
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

    const provider = payment.meta?.provider || "saveHaven";
    const transferId = payment.meta?.transferId;

    if (!transferId) {
      throw new AppError(
        "Transfer ID not found",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    let verificationResult;

    try {
      switch (provider) {
        case "monnify":
          verificationResult = await this.monnifyService.verifyTransfer(
            reference
          );
          break;

        case "flutterwave":
          verificationResult = await this.flutterwaveService.getTransferStatus(
            transferId
          );
          break;

        case "saveHaven":
          verificationResult = await this.saveHavenService.verifyPayment(
            transferId
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

      logger.info(
        `Withdrawal verified: ${reference} - Status: ${status} via ${provider}`
      );

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
      monnify: {
        SUCCESS: "success",
        SUCCESSFUL: "success",
        PAID: "success",
        FAILED: "failed",
        PENDING: "processing",
        PROCESSING: "processing",
      },
      flutterwave: {
        successful: "success",
        SUCCESSFUL: "success",
        success: "success",
        failed: "failed",
        FAILED: "failed",
        pending: "processing",
        PENDING: "processing",
        processing: "processing",
        PROCESSING: "processing",
      },
      saveHaven: {
        successful: "success",
        success: "success",
        failed: "failed",
        pending: "processing",
        processing: "processing",
      },
    };

    return (
      statusMap[provider]?.[providerStatus] ||
      statusMap[provider]?.[providerStatus.toUpperCase()] ||
      statusMap[provider]?.[providerStatus.toLowerCase()] ||
      "pending"
    );
  }
}
