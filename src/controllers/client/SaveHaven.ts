import { PROVIDERS } from "@/config";
import logger from "@/logger";
import { AppError } from "@/middlewares/errorHandler";
import { ERROR_CODES } from "@/utils/constants";
import axios, { AxiosInstance } from "axios";

export interface SaveHavenAccountData {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  reference: string;
  status: string;
  created_at: string;
  expires_at?: string;
}

export interface SaveHavenCreateAccountRes {
  success: boolean;
  message: string;
  data: SaveHavenAccountData;
}

export interface SaveHavenBankData {
  bank_name: string;
  bank_code: string;
  bank_slug: string;
}

export class SaveHavenService {
  private client: AxiosInstance;
  private provider = PROVIDERS.SAVEHAVEN;

  constructor() {
    this.client = axios.create({
      baseURL: this.provider.baseUrl,
      headers: {
        Authorization: `Bearer ${this.provider.secretKey}`,
        "Content-Type": "application/json",
        "x-api-key": this.provider.apiKey,
      },
    });
  }

  // Verify bank account
  async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<{ account_name: string; account_number: string }> {
    try {
      const response = await this.client.post("/account/verify", {
        account_number: accountNumber,
        bank_code: bankCode,
      });

      if (!response.data.success) {
        throw new AppError(
          response.data.message || "Account verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Verified account: ${accountNumber}`);
      return {
        account_name: response.data.data.account_name,
        account_number: response.data.data.account_number,
      };
    } catch (error: any) {
      logger.error("Error verifying bank account:", error);
      throw new AppError(
        error.response?.data?.message || "Account verification failed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Get list of banks
  async getBanks(country: string = "NG"): Promise<SaveHavenBankData[]> {
    try {
      const response = await this.client.get("/banks", {
        params: { country },
      });

      if (!response.data.success) {
        throw new AppError(
          "Failed to fetch banks",
          500,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info(`Fetched banks for ${country}`);
      return response.data.data;
    } catch (error: any) {
      logger.error("Error fetching banks:", error);
      throw new AppError(
        "Failed to fetch banks",
        500,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  // Create virtual account for wallet funding (temporary)
  async createVirtualAccount(data: {
    email: string;
    firstname: string;
    amount?: number;
    lastname: string;
    reference: string;
    phone?: string;
    bvn?: string;
  }): Promise<SaveHavenAccountData> {
    try {
      const response = await this.client.post("/virtual-account/create", {
        email: data.email,
        first_name: data.firstname,
        last_name: data.lastname,
        phone: data.phone || "",
        bvn: data.bvn || "",
        reference: data.reference,
        is_permanent: false, // Temporary account for one-time funding
        preferred_bank: "wema", // or other supported banks
      });

      if (!response.data.success) {
        throw new AppError(
          response.data.message || "Failed to create virtual account",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Created virtual account for ${data.email}`);
      return response.data.data;
    } catch (error: any) {
      logger.error("Error creating virtual account:", error);
      throw new AppError(
        error.response?.data?.message || "Failed to create virtual account",
        400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  // Verify payment/transaction (for wallet funding confirmation)
  async verifyPayment(reference: string): Promise<any> {
    try {
      const response = await this.client.get(`/transaction/verify/${reference}`);

      if (!response.data.success) {
        throw new AppError(
          "Payment verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Verified payment: ${reference}`);
      return response.data.data;
    } catch (error: any) {
      logger.error("Error verifying payment:", error);
      throw new AppError(
        "Payment verification failed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Initiate transfer/payout (for withdrawal from wallet to bank)
  async initiateTransfer(data: {
    amount: number;
    bank_code?: string;
    account_bank: string;
    account_number: string;
    account_name?: string;
    narration: string;
    reference: string;
    currency?: string;
    beneficiary_name?: string;
  }): Promise<any> {
    try {
      const response = await this.client.post("/transfer/initiate", {
        amount: data.amount,
        account_bank: data.account_bank,
        account_number: data.account_number,
        narration: data.narration,
        reference: data.reference,
        currency: data.currency || "NGN",
        callback_url: `${process.env.BASE_URL}/api/webhooks/savehaven/transfer`,
        beneficiary_name: data.beneficiary_name,
      });

      if (!response.data.success) {
        throw new AppError(
          response.data.message || "Transfer failed",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Initiated transfer: ${data.reference}`);
      return response.data.data;
    } catch (error: any) {
      logger.error("Error initiating transfer:", error);
      throw new AppError(
        error.response?.data?.message || "Transfer failed",
        400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  // Initialize payment (alternative to virtual account - redirect payment)
  async initiatePayment(data: {
    email: string;
    amount: number;
    reference: string;
    callback_url?: string;
    metadata?: any;
    customer_name?: string;
  }): Promise<any> {
    try {
      const response = await this.client.post("/payment/initialize", {
        email: data.email,
        amount: data.amount,
        reference: data.reference,
        callback_url: data.callback_url,
        metadata: data.metadata,
        customer_name: data.customer_name,
        currency: "NGN",
      });

      if (!response.data.success) {
        throw new AppError(
          response.data.message || "Payment initiation failed",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Initiated payment: ${data.reference}`);
      return response.data.data;
    } catch (error: any) {
      logger.error("Error initiating payment:", error);
      throw new AppError(
        error.response?.data?.message || "Payment initiation failed",
        400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  // Get transfer fee
  async getTransferFee(amount: number): Promise<number> {
    try {
      const response = await this.client.get("/transfer/fee", {
        params: { amount },
      });

      if (!response.data.success) {
        throw new AppError(
          "Failed to get transfer fee",
          500,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      return response.data.data.fee || 0;
    } catch (error: any) {
      logger.error("Error getting transfer fee:", error);
      // Return default fee if API fails
      return 50;
    }
  }

  // Get wallet balance
  async getBalance(): Promise<number> {
    try {
      const response = await this.client.get("/wallet/balance");

      if (!response.data.success) {
        throw new AppError(
          "Failed to get balance",
          500,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info("Fetched wallet balance");
      return response.data.data.balance;
    } catch (error: any) {
      logger.error("Error getting balance:", error);
      throw new AppError(
        "Failed to get balance",
        500,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  // Query transaction status
  async getTransactionStatus(reference: string): Promise<any> {
    try {
      const response = await this.client.get(`/transaction/status/${reference}`);

      if (!response.data.success) {
        throw new AppError(
          "Failed to get transaction status",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Fetched status for transaction: ${reference}`);
      return response.data.data;
    } catch (error: any) {
      logger.error("Error getting transaction status:", error);
      throw new AppError(
        error.response?.data?.message || "Failed to get transaction status",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Verify transfer status (for withdrawal tracking)
  async verifyTransfer(reference: string): Promise<any> {
    try {
      const response = await this.client.get(`/transfer/verify/${reference}`);

      if (!response.data.success) {
        throw new AppError(
          "Transfer verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Verified transfer: ${reference}`);
      return response.data.data;
    } catch (error: any) {
      logger.error("Error verifying transfer:", error);
      throw new AppError(
        error.response?.data?.message || "Transfer verification failed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }
}