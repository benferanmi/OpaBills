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
import { ProviderService } from "./ProviderService";
import { Transaction } from "@/models/wallet/Transaction";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletRepository } from "@/repositories/WalletRepository";
import { VirtualAccountRepository } from "@/repositories/VirtualAccountRepository";
import mongoose from "mongoose";
import { Wallet } from "@/models/wallet/Wallet";
import { Deposit } from "@/models/banking/Deposit";

export interface InitializePaymentDTO {
  userId: string;
  amount: number;
  method?: string;
  provider?: "monnify" | "saveHaven" | "flutterwave";
}

export class PaymentService {
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  private transactionRepository: TransactionRepository;
  private saveHavenService: SaveHavenService;
  private monnifyService: MonnifyService;
  private flutterwaveService: FlutterwaveService;
  private providerService: ProviderService;
  private walletRepository: WalletRepository;
  private virtualAccountRepository: VirtualAccountRepository;

  constructor() {
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
    this.saveHavenService = new SaveHavenService();
    this.monnifyService = new MonnifyService();
    this.flutterwaveService = new FlutterwaveService();
    this.providerService = new ProviderService();
    this.transactionRepository = new TransactionRepository();
    this.walletRepository = new WalletRepository();
    this.virtualAccountRepository = new VirtualAccountRepository();
  }

  async getProviders(): Promise<any> {
    const result = await this.providerService.getServicesByServiceTypeCode(
      "deposit"
    );
    return result;
  }

  // Initialize payment by creating virtual account
  async initializePayment(data: InitializePaymentDTO): Promise<any> {
    const reference = generateReference("VACCT");
    const provider = data.provider || "saveHaven";

    try {
      // Get user details for virtual account creation
      const user = await User.findById(data.userId);
      if (!user) {
        throw new AppError("User not found", 404, ERROR_CODES.NOT_FOUND);
      }

      if (!user.bvn) {
        throw new AppError(
          "BVN is required",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Get user wallet
      const wallet = await this.walletRepository.findByUserId(data.userId);
      if (!wallet) {
        throw new AppError(
          "Wallet not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      let virtualAccountData;
      let accountType: "permanent" | "temporary" = "temporary";

      switch (provider) {
        // monnify does not support temporary accounts
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

          // Flutterwave accounts are temporary with expiry
          const expiresAt = flutterwaveAccount.expiry_date
            ? new Date(flutterwaveAccount.expiry_date)
            : new Date(Date.now() + 24 * 60 * 60 * 1000);

          await this.virtualAccountRepository.create({
            userId: user._id,
            accountNumber: flutterwaveAccount.account_number,
            accountName: flutterwaveAccount.account_name,
            bankName: flutterwaveAccount.bank_name,
            provider: "flutterwave",
            accountReference: flutterwaveAccount.account_reference,
            orderReference: flutterwaveAccount.account_reference,
            type: accountType,
            isActive: true,
            expiredAt: expiresAt,
            meta: {
              amount: data.amount,
              expiryDate: flutterwaveAccount.expiry_date,
            },
          } as any);

          virtualAccountData = {
            account_number: flutterwaveAccount.account_number,
            bank_name: flutterwaveAccount.bank_name,
            account_name: flutterwaveAccount.account_name,
            expires_at: flutterwaveAccount.expiry_date,
            type: accountType,
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

          const saveHavenExpiresAt =
            saveHavenAccount.expires_at ||
            new Date(Date.now() + 24 * 60 * 60 * 1000);

          await this.virtualAccountRepository.create({
            userId: user._id,
            accountNumber: saveHavenAccount.account_number,
            accountName: saveHavenAccount.account_name,
            bankName: saveHavenAccount.bank_name,
            provider: "saveHaven",
            type: accountType,
            isActive: true,
            expiredAt: saveHavenExpiresAt,
            meta: {
              amount: data.amount,
            },
          } as any);

          virtualAccountData = {
            account_number: saveHavenAccount.account_number,
            bank_name: saveHavenAccount.bank_name,
            account_name: saveHavenAccount.account_name,
            expires_at: saveHavenAccount.expires_at,
            type: accountType,
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
        reference: reference,
        amount: data.amount,
        provider: provider,
        virtualAccount: {
          accountNumber: virtualAccountData.account_number,
          bankName: virtualAccountData.bank_name,
          accountName: virtualAccountData.account_name,
          expiresAt: virtualAccountData.expires_at,
          // accounts: virtualAccountData.accounts,
          type: virtualAccountData.type,
        },
      };
    } catch (error: any) {
      logger.error(`Failed to create virtual account for ${reference}:`, error);
      throw new AppError(
        error.message || "Failed to generate payment account",
        400,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  // Verify payment (manual verification by user)
  // Creates: Deposit (audit) + Transaction (user-facing) + Credits Wallet
  async verifyPayment(reference: string): Promise<any> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find virtual account by reference or account number
      const virtualAccount = await this.virtualAccountRepository.findOne({
        $or: [
          { accountReference: reference },
          { accountNumber: reference },
          { orderReference: reference },
        ],
        isActive: true,
      });

      if (!virtualAccount) {
        throw new AppError(
          "Virtual account not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      const provider = virtualAccount.provider;
      const userId = virtualAccount.userId;

      // Check if already verified (idempotency)
      const existingTransaction = await Transaction.findOne({
        $or: [
          { providerReference: reference },
          { idempotencyKey: reference },
          { "meta.verificationReference": reference },
        ],
        type: "wallet_funding",
        status: "success",
      });

      if (existingTransaction) {
        await session.abortTransaction();
        logger.info("Payment already verified", {
          transactionId: existingTransaction._id,
          reference,
        });
        return {
          reference: existingTransaction.reference,
          amount: existingTransaction.amount,
          status: "success",
          provider: provider,
          balance: existingTransaction.balanceAfter,
        };
      }

      let verificationResult;
      let amount = 0;

      // Query provider for payment status
      switch (provider) {
        case "monnify":
          verificationResult = await this.monnifyService.verifyPayment(
            reference
          );

          if (
            verificationResult.paymentStatus !== "PAID" ||
            !verificationResult.settlementAmount
          ) {
            throw new AppError(
              "Payment not confirmed by Monnify",
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR
            );
          }

          amount = verificationResult.settlementAmount;
          break;

        case "flutterwave":
          const txRef = virtualAccount.orderReference || reference;
          verificationResult = await this.flutterwaveService.verifyTransaction(
            txRef
          );

          if (
            verificationResult.status !== "successful" ||
            !verificationResult.amount
          ) {
            throw new AppError(
              "Payment not confirmed by Flutterwave",
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR
            );
          }

          amount = verificationResult.amount;
          break;

        case "saveHaven":
          verificationResult = await this.saveHavenService.verifyPayment(
            reference
          );

          if (!verificationResult || !verificationResult.amount) {
            throw new AppError(
              "Payment not confirmed by SaveHaven",
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.VALIDATION_ERROR
            );
          }

          amount = verificationResult.amount;
          break;

        default:
          throw new AppError(
            "Invalid payment provider",
            400,
            ERROR_CODES.INVALID_PROVIDER
          );
      }

      // Get wallet and capture balance BEFORE any changes
      const wallet = await this.walletRepository.findByUserId(userId);
      if (!wallet) {
        throw new AppError(
          "Wallet not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      const balanceBefore = wallet.balance;
      const balanceAfter = balanceBefore + amount;

      // Create Deposit record (audit trail)
      const depositReference = generateReference("DEP");
      const deposit = await Deposit.create(
        [
          {
            userId: userId,
            walletId: wallet._id,
            reference: depositReference,
            provider: provider,
            amount: amount,
            status: "success",
            meta: {
              verificationData: verificationResult,
              providerReference: reference,
              virtualAccountId: virtualAccount._id,
              manualVerification: true,
              verifiedAt: new Date(),
            },
          },
        ],
        { session }
      );

      // Create Transaction record (user-facing)
      const transactionReference = generateReference("TXN");
      const transaction = await Transaction.create(
        [
          {
            walletId: wallet._id,
            sourceId: userId,
            reference: transactionReference,
            providerReference: reference,
            idempotencyKey: reference, // Prevent duplicate verification
            transactableType: "Deposit",
            transactableId: deposit[0]._id,
            amount: amount,
            direction: "CREDIT",
            type: "wallet_funding",
            provider: provider,
            status: "success",
            purpose: "Manual deposit verification",
            balanceBefore,
            balanceAfter,
            initiatedBy: userId,
            initiatedByType: "user",
            meta: {
              depositId: deposit[0]._id,
              depositReference: depositReference,
              provider: provider,
              virtualAccountId: virtualAccount._id,
              verificationData: verificationResult,
              verificationReference: reference,
              manualVerification: true,
            },
          },
        ],
        { session }
      );

      // Credit wallet
      await Wallet.findByIdAndUpdate(
        wallet._id,
        { $inc: { balance: amount } },
        { session }
      );

      await session.commitTransaction();

      // Send notification (outside session)
      await this.notificationRepository.create({
        type: "payment_success",
        notifiableType: "User",
        notifiableId: userId,
        data: {
          transactionType: "Wallet Funding",
          amount: amount,
          reference: transactionReference,
          provider: provider,
          balance: balanceAfter,
        },
      });

      logger.info(
        `Payment verified successfully: ${reference} via ${provider}`,
        {
          userId,
          amount,
          transactionReference,
        }
      );

      return {
        reference: transactionReference,
        amount: amount,
        status: "success",
        provider: provider,
        balance: balanceAfter,
      };
    } catch (error: any) {
      await session.abortTransaction();
      logger.error(`Failed to verify payment for ${reference}:`, error);
      throw new AppError(
        error.message || "Payment verification failed",
        error.statusCode || HTTP_STATUS.BAD_REQUEST,
        error.errorCode || ERROR_CODES.VALIDATION_ERROR
      );
    } finally {
      session.endSession();
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
