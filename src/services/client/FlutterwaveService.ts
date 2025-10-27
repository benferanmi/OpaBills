import { PROVIDERS } from "@/config";
import logger from "@/logger";
import { AppError } from "@/middlewares/errorHandler";
import { ERROR_CODES } from "@/utils/constants";
import axios, { AxiosInstance } from "axios";
import { Bank } from "@/models/reference/Bank";

export interface CreateAccountRes {
  status: boolean;
  message: string;
  data: AccountDataRes;
}
export interface AccountDataRes {
  response_code: string;
  response_message: string;
  account_status: string;
  flw_ref: string;
  order_ref: string;
  expiry_date: string;
  created_at: string;
  note: string;
  amount: string;
  frequency: string;
  account_number: string;
  bank_name: string;
  account_name: string;
  expires_at: string;
}
export class FlutterwaveService {
  private client: AxiosInstance;
  private provider = PROVIDERS.FLUTTERWAVE;

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
      const response = await this.client.post("/accounts/resolve", {
        account_number: accountNumber,
        account_bank: bankCode,
      });

      if (response.data.status !== "success") {
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
      const response = await this.client.get("/banks/" + country);

      if (response.data.status !== "success") {
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

  // Sync banks to MongoDB
  async syncBanks(country: string = "NG"): Promise<void> {
    try {
      console.log("called");
      const banks = await this.getBanks(country);

      console.log("banks", banks);

      for (const bank of banks) {
        await Bank.findOneAndUpdate(
          { name: bank.name },
          {
            $set: {
              name: bank.name,
              flutterwaveCode: bank.code,
              universalCode: bank.code,
              country: country,
              currency: "NGN",
              isActive: true,
            },
          },
          { upsert: true, new: true }
        );
      }

      logger.info(`✅ Synced ${banks.length} Flutterwave banks`);
    } catch (error: any) {
      logger.error("Error syncing Flutterwave banks:", error);
      throw new AppError(
        "Failed to sync Flutterwave banks",
        500,
        ERROR_CODES.DATABASE_ERROR
      );
    }
  }

  // Create virtual account
  async createVirtualAccount(data: {
    email: string;
    is_permanent: boolean;
    bvn?: string;
    nin?: string;
    amount?: number;
    tx_ref: string;
    firstname: string;
    lastname: string;
    narration: string;
  }): Promise<AccountDataRes> {
    try {
      if (!data.bvn && !data.nin) {
        throw new AppError(
          "Bvn or NIN is required",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const response = await this.client.post("/virtual-account-numbers", data);

      if (response.data.status !== "success") {
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

  // Verify payment using flutterwave transaction ID

  async verifyPayment(transactionId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/transactions/${transactionId}/verify`
      );

      if (response.data.status !== "success") {
        throw new AppError(
          "Payment verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Verified payment: ${transactionId}`);
      return response.data.data;
    } catch (error: any) {
      if (error.response?.data) {
        logger.error(
          "Flutterwave error response:",
          error.response.success,
          error.response.data
        );
      }
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
    account_bank: string;
    account_number: string;
    amount: number;
    narration: string;
    currency: string;
    reference: string;
    callback_url?: string;
    debit_currency?: string;
    beneficiary_name?: string;
  }): Promise<any> {
    try {
      const response = await this.client.post("/transfers", data);

      if (response.data.status !== "success") {
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

  async initiatePayment(data: {
    amount: number;
    currency: string;
    redirect_url: string;
    payment_options: string;
    customer: {
      email: string;
      phonenumber?: string;
      name?: string;
    };
    tx_ref: string;
    meta?: any;
    customizations?: {
      title?: string;
      description?: string;
      logo?: string;
    };
  }): Promise<any> {
    try {
      const response = await this.client.post("/payments", data);

      if (response.data.status !== "success") {
        throw new AppError(
          "Payment initiation failed",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Initiated payment: ${data.tx_ref}`);
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
      const response = await this.client.get("/transfers/fee", {
        params: { amount, currency: "NGN" },
      });

      if (response.data.status !== "success") {
        throw new AppError(
          "Failed to get transfer fee",
          500,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      return response.data.data[0]?.fee || 0;
    } catch (error: any) {
      logger.error("Error getting transfer fee:", error);
      // Return default fee if API fails
      return 0;
    }
  }
}
