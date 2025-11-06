import { PROVIDERS } from "@/config";
import logger from "@/logger";
import { AppError } from "@/middlewares/errorHandler";
import { ERROR_CODES } from "@/utils/constants";
import axios, { AxiosInstance } from "axios";

export interface FlutterwaveAccountData {
  account_number: string;
  account_reference: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  email: string;
  bvn: string;
  amount?: number;
  split_code?: string;
  tx_ref: string;
  frequency: string;
  duration?: string;
  is_permanent: boolean;
  created_at: string;
  expiry_date?: string;
}

export interface FlutterwaveCreateAccountRes {
  status: string;
  message: string;
  data: FlutterwaveAccountData;
}

export interface FlutterwaveBankData {
  id: number;
  code: string;
  name: string;
}

export interface FlutterwaveTransferData {
  id: number;
  account_number: string;
  bank_code: string;
  full_name: string;
  created_at: string;
  currency: string;
  debit_currency?: string;
  amount: number;
  fee: number;
  status: string;
  reference: string;
  meta?: any;
  narration: string;
  complete_message: string;
  requires_approval: number;
  is_approved: number;
  bank_name: string;
}

export interface FlutterwaveBalanceData {
  currency: string;
  available_balance: number;
  ledger_balance: number;
}

export class FlutterwaveService {
  private client: AxiosInstance;
  private provider = PROVIDERS.FLUTTERWAVE;

  constructor() {
    this.client = axios.create({
      baseURL: this.provider.baseUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.provider.secretKey}`,
      },
      validateStatus: () => true,
    });
  }

  // Helper to check if response is successful
  private isSuccessResponse(status: string): boolean {
    return status === "success";
  }

  /**
   * Name Enquiry / Account Resolution
   * Verifies bank account details
   */
  async nameEnquiry(
    accountNumber: string,
    accountBank: string
  ): Promise<{ accountNumber: string; accountName: string; bankCode: string }> {
    try {
      const response = await this.client.post("/accounts/resolve", {
        account_number: accountNumber,
        account_bank: accountBank,
      });

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Flutterwave name enquiry failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Account verification failed",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Flutterwave: Verified account: ${accountNumber}`);
      return {
        accountNumber: response.data.data.account_number,
        accountName: response.data.data.account_name,
        bankCode: accountBank,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error verifying bank account:", error);
      throw new AppError(
        error.response?.data?.message || "Account verification failed",
        error.response?.status || 400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  /**
   * Get list of Nigerian banks
   * @param country - Default is "NG" for Nigeria
   */
  async getBanks(country: string = "NG"): Promise<FlutterwaveBankData[]> {
    try {
      const response = await this.client.get(`/banks/${country}`);

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Failed to fetch banks:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to fetch banks",
          response.status,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info(`Flutterwave: Fetched banks for ${country}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error fetching banks:", error);
      throw new AppError(
        "Failed to fetch banks",
        500,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  /**
   * Create Virtual Account Number (VAN)
   * Can be temporary or permanent based on is_permanent flag
   */
  async createVirtualAccount(data: {
    email: string;
    firstname: string;
    lastname: string;
    reference: string;
    bvn: string;
    phone?: string;
    isPermanent?: boolean;
    amount?: number; // For temporary accounts
  }): Promise<FlutterwaveAccountData> {
    try {
      const payload: any = {
        email: data.email,
        is_permanent: data.isPermanent !== false, // Default to true
        bvn: data.bvn,
        tx_ref: data.reference,
        firstname: data.firstname,
        lastname: data.lastname,
        narration: `${data.firstname} ${data.lastname}`,
      };

      // Add phone if provided
      if (data.phone) {
        payload.phonenumber = data.phone.startsWith("234")
          ? data.phone
          : "234" + data.phone.replace(/^0/, "");
      }

      // For temporary accounts, amount is required
      if (!data.isPermanent && data.amount) {
        payload.amount = data.amount;
      }

      logger.info("Creating Flutterwave virtual account:", {
        email: payload.email,
        isPermanent: payload.is_permanent,
      });

      const response = await this.client.post(
        "/virtual-account-numbers",
        payload
      );

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Failed to create virtual account:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to create virtual account",
          response.status,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Flutterwave: Created virtual account for ${data.email}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error creating virtual account:", error);
      throw new AppError(
        error.response?.data?.message || "Failed to create virtual account",
        error.response?.status || 400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Get Virtual Account Details
   */
  async getVirtualAccountDetails(
    orderRef: string
  ): Promise<FlutterwaveAccountData> {
    try {
      const response = await this.client.get(
        `/virtual-account-numbers/${orderRef}`
      );

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Failed to get virtual account details:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to get account details",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Flutterwave: Retrieved account details: ${orderRef}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error getting account details:", error);
      throw new AppError(
        error.response?.data?.message || "Failed to get account details",
        error.response?.status || 400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  /**
   * Update BVN for existing virtual account
   */
  async updateVirtualAccountBVN(data: {
    orderRef: string;
    bvn: string;
  }): Promise<FlutterwaveAccountData> {
    try {
      const response = await this.client.put(
        `/virtual-account-numbers/${data.orderRef}`,
        {
          bvn: data.bvn,
        }
      );

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Failed to update virtual account BVN:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to update account BVN",
          response.status,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Flutterwave: Updated BVN for account: ${data.orderRef}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error updating account BVN:", error);
      throw new AppError(
        error.response?.data?.message || "Failed to update account BVN",
        error.response?.status || 400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Verify Transaction
   * Used to confirm payment/deposit to virtual account
   */
  async verifyTransaction(transactionId: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/transactions/${transactionId}/verify`
      );

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Transaction verification failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Transaction verification failed",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Flutterwave: Verified transaction: ${transactionId}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error verifying transaction:", error);
      throw new AppError(
        error.response?.data?.message || "Transaction verification failed",
        error.response?.status || 400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  /**
   * Initiate Transfer/Payout
   * Transfer funds from Flutterwave wallet to bank account
   */
  async initiateTransfer(data: {
    accountBank: string;
    accountNumber: string;
    amount: number;
    narration: string;
    reference: string;
    currency?: string;
    callbackUrl?: string;
    beneficiaryName?: string;
  }): Promise<FlutterwaveTransferData> {
    try {
      const payload: any = {
        account_bank: data.accountBank,
        account_number: data.accountNumber,
        amount: data.amount,
        narration: data.narration,
        currency: data.currency || "NGN",
        reference: data.reference,
        callback_url: data.callbackUrl,
        debit_currency: data.currency || "NGN",
      };

      // Add beneficiary name if provided
      if (data.beneficiaryName) {
        payload.beneficiary_name = data.beneficiaryName;
      }

      logger.info("Initiating Flutterwave transfer:", {
        reference: data.reference,
        amount: data.amount,
        accountNumber: data.accountNumber,
      });

      const response = await this.client.post("/transfers", payload);

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Transfer initiation failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Transfer failed",
          response.status,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Flutterwave: Transfer initiated: ${data.reference}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error initiating transfer:", error);
      throw new AppError(
        error.response?.data?.message || "Transfer failed",
        error.response?.status || 400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Bulk Transfer
   * Initiate multiple transfers at once
   */
  async initiateBulkTransfer(data: {
    title: string;
    bulkData: Array<{
      bank_code: string;
      account_number: string;
      amount: number;
      narration: string;
      reference: string;
      beneficiary_name?: string;
    }>;
  }): Promise<any> {
    try {
      const payload = {
        title: data.title,
        bulk_data: data.bulkData.map((item) => ({
          bank_code: item.bank_code,
          account_number: item.account_number,
          amount: item.amount,
          currency: "NGN",
          narration: item.narration,
          reference: item.reference,
          beneficiary_name: item.beneficiary_name,
        })),
      };

      const response = await this.client.post("/bulk-transfers", payload);

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Bulk transfer failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Bulk transfer failed",
          response.status,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Flutterwave: Bulk transfer initiated: ${data.title}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error initiating bulk transfer:", error);
      throw new AppError(
        error.response?.data?.message || "Bulk transfer failed",
        error.response?.status || 400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Get Transfer Details/Status
   * Check status of a transfer
   */
  async getTransferStatus(
    transferId: string
  ): Promise<FlutterwaveTransferData> {
    try {
      const response = await this.client.get(`/transfers/${transferId}`);

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Failed to get transfer status:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to get transfer status",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Flutterwave: Retrieved transfer status: ${transferId}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error getting transfer status:", error);
      throw new AppError(
        error.response?.data?.message || "Failed to get transfer status",
        error.response?.status || 400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  /**
   * Retry Failed Transfer
   */
  async retryTransfer(transferId: string): Promise<FlutterwaveTransferData> {
    try {
      const response = await this.client.post(
        `/transfers/${transferId}/retries`
      );

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Transfer retry failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Transfer retry failed",
          response.status,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Flutterwave: Retried transfer: ${transferId}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error retrying transfer:", error);
      throw new AppError(
        error.response?.data?.message || "Transfer retry failed",
        error.response?.status || 400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  /**
   * Get Transfer Fee
   * Calculate transfer fee for a given amount
   */
  async getTransferFee(
    amount: number,
    currency: string = "NGN"
  ): Promise<number> {
    try {
      const response = await this.client.get("/transfers/fee", {
        params: {
          amount,
          currency,
        },
      });

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.warn("Failed to get transfer fee, using default");
        // Return default fee if API call fails
        return this.calculateDefaultFee(amount);
      }

      logger.info(`Flutterwave: Retrieved transfer fee for amount: ${amount}`);
      return response.data.data[0]?.fee || this.calculateDefaultFee(amount);
    } catch (error: any) {
      logger.error("Flutterwave: Error getting transfer fee:", error);
      return this.calculateDefaultFee(amount);
    }
  }

  /**
   * Calculate default transfer fee (fallback)
   */
  private calculateDefaultFee(amount: number): number {
    // Flutterwave typical fee structure
    if (amount <= 5000) return 10.75;
    if (amount <= 50000) return 26.88;
    return 53.75;
  }

  /**
   * Get Wallet Balance
   * Retrieve available balance in Flutterwave wallet
   */
  async getWalletBalance(
    currency: string = "NGN"
  ): Promise<FlutterwaveBalanceData> {
    try {
      const response = await this.client.get(`/balances/${currency}`);

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Failed to get wallet balance:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to get wallet balance",
          response.status,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info(`Flutterwave: Retrieved wallet balance for ${currency}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error getting wallet balance:", error);
      throw new AppError(
        "Failed to get wallet balance",
        500,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  /**
   * Get All Wallet Balances
   * Retrieve balances for all currencies
   */
  async getAllBalances(): Promise<FlutterwaveBalanceData[]> {
    try {
      const response = await this.client.get("/balances");

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Failed to get balances:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to get balances",
          response.status,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info("Flutterwave: Retrieved all wallet balances");
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error getting balances:", error);
      throw new AppError(
        "Failed to get balances",
        500,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  /**
   * Verify BVN
   * Validate BVN details
   */
  async verifyBVN(bvn: string): Promise<any> {
    try {
      const response = await this.client.get(`/kyc/bvns/${bvn}`);

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("BVN verification failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "BVN verification failed",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Flutterwave: Verified BVN: ${bvn.substring(0, 3)}***`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error verifying BVN:", error);
      throw new AppError(
        error.response?.data?.message || "BVN verification failed",
        error.response?.status || 400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  /**
   * Get Transactions
   * Retrieve transaction history
   */
  async getTransactions(params?: {
    from?: string;
    to?: string;
    page?: number;
    currency?: string;
    status?: string;
  }): Promise<any> {
    try {
      const response = await this.client.get("/transactions", {
        params: {
          from: params?.from,
          to: params?.to,
          page: params?.page || 1,
          currency: params?.currency,
          status: params?.status,
        },
      });

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Failed to get transactions:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to get transactions",
          response.status,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info("Flutterwave: Retrieved transactions");
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error getting transactions:", error);
      throw new AppError(
        "Failed to get transactions",
        500,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  /**
   * Initiate Payment (Card/Bank)
   * Alternative funding method - creates payment link
   */
  async initiatePayment(data: {
    txRef: string;
    amount: number;
    currency?: string;
    redirectUrl: string;
    customerEmail: string;
    customerName: string;
    customerPhone?: string;
    paymentOptions?: string;
    meta?: any;
  }): Promise<any> {
    try {
      const payload: any = {
        tx_ref: data.txRef,
        amount: data.amount,
        currency: data.currency || "NGN",
        redirect_url: data.redirectUrl,
        customer: {
          email: data.customerEmail,
          name: data.customerName,
          phonenumber: data.customerPhone,
        },
        customizations: {
          title: "Wallet Funding",
          description: "Fund your wallet",
        },
        payment_options: data.paymentOptions || "card,banktransfer,ussd",
      };

      if (data.meta) {
        payload.meta = data.meta;
      }

      const response = await this.client.post("/payments", payload);

      if (
        response.status !== 200 ||
        !this.isSuccessResponse(response.data.status)
      ) {
        logger.error("Payment initiation failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Payment initiation failed",
          response.status,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Flutterwave: Payment initiated: ${data.txRef}`);
      return response.data.data;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("Flutterwave: Error initiating payment:", error);
      throw new AppError(
        error.response?.data?.message || "Payment initiation failed",
        error.response?.status || 400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }
}
