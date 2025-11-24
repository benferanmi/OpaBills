import { PROVIDERS } from "@/config";
import logger from "@/logger";
import { AppError } from "@/middlewares/errorHandler";
import { ERROR_CODES } from "@/utils/constants";
import axios, { AxiosInstance } from "axios";

export interface MonnifyAccountData {
  contractCode: string;
  accountReference: string;
  accountName: string;
  currencyCode: string;
  customerEmail: string;
  customerName: string;
  accounts: Array<{
    bankCode: string;
    bankName: string;
    accountNumber: string;
  }>;
  collectionChannel: string;
  reservationReference: string;
  reservedAccountType: string;
  status: string;
  createdOn: string;
  bvn?: string;
  nin?: string;
  restrictPaymentSource?: boolean;
}

export interface MonnifyCreateAccountRes {
  requestSuccessful: boolean;
  responseMessage: string;
  responseCode: string;
  responseBody: MonnifyAccountData;
}

export interface MonnifyBankData {
  name: string;
  code: string;
  ussdTemplate: string;
  baseUssdCode: string;
  transferUssdTemplate: string;
}

export class MonnifyService {
  private client: AxiosInstance;
  private provider = PROVIDERS.MONNIFY;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.client = axios.create({
      baseURL: this.provider.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // Authenticate and get access token
  private async authenticate(): Promise<string | null> {
    try {
      // Check if token is still valid (with 5 min buffer)
      if (this.accessToken && Date.now() < this.tokenExpiry - 300000) {
        return this.accessToken;
      }

      const credentials = Buffer.from(
        `${this.provider.apiKey}:${this.provider.secretKey}`
      ).toString("base64");

      const response = await axios.post(
        `${this.provider.baseUrl}/api/v1/auth/login`,
        {},
        {
          headers: {
            Authorization: `Basic ${credentials}`,
          },
        }
      );

      if (!response.data.requestSuccessful) {
        throw new AppError(
          "Monnify authentication failed",
          401,
          ERROR_CODES.AUTHENTICATION_ERROR
        );
      }

      this.accessToken = response.data.responseBody.accessToken;
      this.tokenExpiry =
        Date.now() + response.data.responseBody.expiresIn * 1000;

      logger.info("Monnify authentication successful");
      return this.accessToken;
    } catch (error: any) {
      logger.error("Error authenticating with Monnify:", error);
      throw new AppError(
        "Monnify authentication failed",
        401,
        ERROR_CODES.AUTHENTICATION_ERROR
      );
    }
  }

  // Make authenticated request
  private async makeAuthenticatedRequest(
    method: string,
    url: string,
    data?: any
  ): Promise<any> {
    const token = await this.authenticate();

    try {
      const response = await this.client.request({
        method,
        url,
        data,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error(
        `Monnify ${method} request error to ${url}:`,
        error.response?.data || error.message
      );
      throw error;
    }
  }

  /**
   * BVN and Account Match Verification
   * Verifies that BVN and account number match
   */
  async verifyBVNAccountMatch(data: {
    bvn: string;
    accountNumber: string;
    bankCode: string;
  }): Promise<{
    accountNumber: string;
    accountName: string;
    bvn: string;
    matchStatus: boolean;
  }> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "POST",
        "/api/v1/vas/bvn-account-match",
        {
          bvn: data.bvn,
          accountNumber: data.accountNumber,
          bankCode: data.bankCode,
        }
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          response.responseMessage || "BVN-Account match verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Monnify: Verified BVN-Account match: ${data.accountNumber}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error verifying BVN-Account match:", error);
      throw new AppError(
        error.response?.data?.responseMessage ||
          "BVN-Account match verification failed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  /**
   * Update existing reserved account with BVN/NIN
   * This is the alternative to creating a new account
   */
  async updateReservedAccountKYC(data: {
    accountReference: string;
    bvn?: string;
    nin?: string;
  }): Promise<MonnifyAccountData> {
    try {
      const payload: any = {
        accountReference: data.accountReference,
      };

      if (data.bvn) {
        payload.bvn = data.bvn;
      }

      if (data.nin) {
        payload.nin = data.nin;
      }

      const response = await this.makeAuthenticatedRequest(
        "PUT",
        "/api/v2/bank-transfer/reserved-accounts",
        payload
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          response.responseMessage || "Failed to update account KYC",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Monnify: Updated account KYC: ${data.accountReference}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error updating account KYC:", error);
      throw new AppError(
        error.response?.data?.responseMessage || "Failed to update account KYC",
        400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  // Verify bank account
  async verifyBankAccount(
    accountNumber: string,
    bankCode: string
  ): Promise<{
    accountName: string;
    accountNumber: string;
    account_name: string;
    account_number: string;
  }> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "GET",
        `/api/v1/disbursements/account/validate?accountNumber=${accountNumber}&bankCode=${bankCode}`
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          response.responseMessage || "Account verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Monnify: Verified account: ${accountNumber}`);
      return {
        account_name: response.responseBody.accountName,
        account_number: accountNumber,
        accountName: response.responseBody.accountName,
        accountNumber: accountNumber,
      };
    } catch (error: any) {
      logger.error("Monnify: Error verifying bank account:", error);
      throw new AppError(
        error.response?.data?.responseMessage || "Account verification failed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Get list of banks
  async getBanks(): Promise<MonnifyBankData[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "GET",
        "/api/v1/banks"
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          "Failed to fetch banks",
          500,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info("Monnify: Fetched banks list");
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error fetching banks:", error);
      throw new AppError(
        "Failed to fetch banks",
        500,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  // Create reserved account for wallet funding (permanent account)
  async createVirtualAccount(data: {
    email: string;
    firstname: string;
    lastname: string;
    reference: string;
    bvn?: string;
    nin?: string;
    getAllBanks?: boolean;
  }): Promise<MonnifyAccountData> {
    try {
      console.log(this.provider);
      const payload: any = {
        accountReference: data.reference,
        accountName: `${data.firstname} ${data.lastname}`,
        currencyCode: "NGN",
        contractCode: this.provider.contractCode,
        customerEmail: data.email,
        customerName: `${data.firstname} ${data.lastname}`,
        getAllAvailableBanks: data.getAllBanks !== false, // Default to true
      };

      // Add BVN if provided
      if (data.bvn) {
        payload.bvn = data.bvn;
      }

      // Add NIN if provided (alternative to BVN)
      if (data.nin) {
        payload.nin = data.nin;
      }

      // Don't add preferredBanks when getAllAvailableBanks is true
      // If you want specific banks, set getAllBanks to false and add preferredBanks
      if (data.getAllBanks === false) {
        // You can add preferredBanks here if needed
        // payload.preferredBanks = ["035", "232"]; // Wema Bank and Sterling Bank
      }

      console.log(payload);

      const response = await this.makeAuthenticatedRequest(
        "POST",
        "/api/v2/bank-transfer/reserved-accounts",
        payload
      );

      console.log(response);

      if (!response.requestSuccessful) {
        throw new AppError(
          response.responseMessage || "Failed to create virtual account",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Monnify: Created virtual account for ${data.email}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error creating virtual account:", error);
      throw new AppError(
        error.response?.data?.responseMessage ||
          "Failed to create virtual account",
        400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  // Verify payment (for wallet funding confirmation)
  async verifyPayment(reference: string): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "GET",
        `/api/v2/transactions/${reference}`
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          "Payment verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Monnify: Verified payment: ${reference}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error verifying payment:", error);
      throw new AppError(
        error.response?.data?.responseMessage || "Payment verification failed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Initiate transfer/disbursement (for withdrawal from wallet to bank)
  // Updated to use correct endpoint and payload structure
  async initiateTransfer(data: {
    amount: number;
    destinationBankCode: string;
    destinationAccountNumber: string;
    narration: string;
    reference: string;
    currency?: string;
    async?: boolean;
  }): Promise<any> {
    try {
      const payload: any = {
        amount: data.amount,
        reference: data.reference,
        narration: data.narration,
        destinationBankCode: data.destinationBankCode,
        destinationAccountNumber: data.destinationAccountNumber,
        currency: data.currency || "NGN",
        sourceAccountNumber: this.provider.walletAccountNumber,
      };

      // Add async parameter if provided
      if (data.async !== undefined) {
        payload.async = data.async;
      }

      const response = await this.makeAuthenticatedRequest(
        "POST",
        "/api/v2/disbursements/single",
        payload
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          response.responseMessage || "Transfer failed",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Monnify: Initiated transfer: ${data.reference}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error initiating transfer:", error);
      throw new AppError(
        error.response?.data?.responseMessage || "Transfer failed",
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
    customerName: string;
    redirectUrl?: string;
  }): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "POST",
        "/api/v1/merchant/transactions/init-transaction",
        {
          amount: data.amount,
          customerName: data.customerName,
          customerEmail: data.email,
          paymentReference: data.reference,
          paymentDescription: "Wallet funding",
          currencyCode: "NGN",
          contractCode: this.provider.contractCode,
          redirectUrl: data.redirectUrl,
          paymentMethods: ["CARD", "ACCOUNT_TRANSFER"],
        }
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          response.responseMessage || "Payment initiation failed",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Monnify: Initiated payment: ${data.reference}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error initiating payment:", error);
      throw new AppError(
        error.response?.data?.responseMessage || "Payment initiation failed",
        400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  // Get transfer fee
  async getTransferFee(amount: number): Promise<number> {
    try {
      // Monnify transfer fee structure
      if (amount <= 5000) return 10;
      if (amount <= 50000) return 25;
      return 50;
    } catch (error: any) {
      logger.error("Monnify: Error calculating transfer fee:", error);
      return 50;
    }
  }

  // Verify transfer status (for withdrawal tracking)
  async verifyTransfer(reference: string): Promise<any> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "GET",
        `/api/v2/disbursements/single/summary?reference=${reference}`
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          "Transfer verification failed",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Monnify: Verified transfer: ${reference}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error verifying transfer:", error);
      throw new AppError(
        error.response?.data?.responseMessage || "Transfer verification failed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Delete/Deallocate reserved account
  async deleteVirtualAccount(accountReference: string): Promise<void> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "DELETE",
        `/api/v1/bank-transfer/reserved-accounts/${accountReference}`
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          "Failed to delete virtual account",
          400,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Monnify: Deleted virtual account: ${accountReference}`);
    } catch (error: any) {
      logger.error("Monnify: Error deleting virtual account:", error);
      throw new AppError(
        error.response?.data?.responseMessage ||
          "Failed to delete virtual account",
        400,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }
  }

  // Get wallet balance
  async getWalletBalance(): Promise<number> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "GET",
        `/api/v1/disbursements/wallet-balance?accountNumber=${this.provider.walletAccountNumber}`
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          "Failed to get wallet balance",
          500,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info("Monnify: Fetched wallet balance");
      return response.responseBody.availableBalance;
    } catch (error: any) {
      logger.error("Monnify: Error getting wallet balance:", error);
      throw new AppError(
        "Failed to get wallet balance",
        500,
        ERROR_CODES.THIRD_PARTY_ERROR
      );
    }
  }

  // Get reserved account details
  async getVirtualAccountDetails(
    accountReference: string
  ): Promise<MonnifyAccountData> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "GET",
        `/api/v2/bank-transfer/reserved-accounts/${accountReference}`
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          "Failed to get account details",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Monnify: Retrieved account details: ${accountReference}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error getting account details:", error);
      throw new AppError(
        error.response?.data?.responseMessage ||
          "Failed to get account details",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // Get all reserved accounts for a customer
  async getCustomerVirtualAccounts(
    customerEmail: string
  ): Promise<MonnifyAccountData[]> {
    try {
      const response = await this.makeAuthenticatedRequest(
        "GET",
        `/api/v2/bank-transfer/reserved-accounts?customerEmail=${customerEmail}`
      );

      if (!response.requestSuccessful) {
        throw new AppError(
          "Failed to get customer accounts",
          400,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Monnify: Retrieved accounts for ${customerEmail}`);
      return response.responseBody;
    } catch (error: any) {
      logger.error("Monnify: Error getting customer accounts:", error);
      throw new AppError(
        error.response?.data?.responseMessage ||
          "Failed to get customer accounts",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }
}
