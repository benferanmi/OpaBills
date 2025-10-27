import { PROVIDERS } from "@/config";
import logger from "@/logger";
import { AppError } from "@/middlewares/errorHandler";
import { ERROR_CODES } from "@/utils/constants";
import axios, { AxiosInstance } from "axios";

export interface PaystackAccountData {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_id: number;
  assigned: boolean;
  currency: string;
  active: boolean;
  id: number;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface PaystackCreateAccountRes {
  status: boolean;
  message: string;
  data: PaystackAccountData;
}

export class PaystackService {
  private client: AxiosInstance;
  private provider = PROVIDERS.PAYSTACK;

  constructor() {
    this.client = axios.create({
      baseURL: this.provider.baseUrl,
      headers: {
        Authorization: `Bearer ${this.provider.secretKey}`,
        "Content-Type": "application/json",
      },
    });
  }

  // Verify bank account
  async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<{ account_name: string; account_number: string }> {
    try {
      const response = await this.client.get("/bank/resolve", {
        params: {
          account_number: accountNumber,
          bank_code: bankCode,
        },
      });

      if (!response.data.status) {
        throw new AppError(
          "Account verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Verified account: ${accountNumber}`);
      return response.data.data;
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
  async getBanks(country: string = "NG"): Promise<any[]> {
    try {
      const response = await this.client.get("/bank", {
        params: { country },
      });

      if (!response.data.status) {
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

  // Create dedicated virtual account (temporary)
  async createVirtualAccount(data: {
    email: string;
    firstname: string;
    amount?: number;
    lastname: string;
    reference: string;
    phone?: string;
  }): Promise<PaystackAccountData> {
    try {
      const response = await this.client.post("/dedicated_account", {
        email: data.email,
        first_name: data.firstname,
        last_name: data.lastname,
        phone: data.phone || "",
        preferred_bank: "wema-bank", // or "titan-paystack"
        country: "NG",
        account_name: `${data.firstname} ${data.lastname}`,
        split_code: data.reference,
      });

      if (!response.data.status) {
        throw new AppError(
          "Failed to create virtual account",
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

  // Verify payment
  async verifyPayment(reference: string): Promise<any> {
    try {
      const response = await this.client.get(`/transaction/verify/${reference}`);

      if (!response.data.status) {
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

  // Initiate transfer
  async initiateTransfer(data: {
    source: string;
    amount: number;
    recipient: string;
    reason: string;
    reference: string;
    currency?: string;
  }): Promise<any> {
    try {
      const response = await this.client.post("/transfer", {
        source: "balance",
        amount: data.amount * 100, // Convert to kobo
        recipient: data.recipient,
        reason: data.reason,
        reference: data.reference,
        currency: data.currency || "NGN",
      });

      if (!response.data.status) {
        throw new AppError(
          "Transfer failed",
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

  // Create transfer recipient
  async createTransferRecipient(data: {
    type: string;
    name: string;
    account_number: string;
    bank_code: string;
    currency?: string;
  }): Promise<any> {
    try {
      const response = await this.client.post("/transferrecipient", {
        type: data.type || "nuban",
        name: data.name,
        account_number: data.account_number,
        bank_code: data.bank_code,
        currency: data.currency || "NGN",
      });

      if (!response.data.status) {
        throw new AppError(
          "Failed to create transfer recipient",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Created transfer recipient: ${data.account_number}`);
      return response.data.data;
    } catch (error: any) {
      logger.error("Error creating transfer recipient:", error);
      throw new AppError(
        error.response?.data?.message || "Failed to create transfer recipient",
        400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  // Initialize payment
  async initiatePayment(data: {
    email: string;
    amount: number;
    reference: string;
    callback_url?: string;
    metadata?: any;
  }): Promise<any> {
    try {
      const response = await this.client.post("/transaction/initialize", {
        email: data.email,
        amount: data.amount * 100, // Convert to kobo
        reference: data.reference,
        callback_url: data.callback_url,
        metadata: data.metadata,
      });

      if (!response.data.status) {
        throw new AppError(
          "Payment initiation failed",
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
  async getTransferFee(): Promise<number> {
    try {
      // Paystack charges flat fee
      return 50; // 50 NGN flat fee for transfers
    } catch (error: any) {
      logger.error("Error getting transfer fee:", error);
      return 50;
    }
  }
}