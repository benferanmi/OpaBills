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

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  message: string;
}

interface NameEnquiryResponse {
  accountName: string;
  accountNumber: string;
  sessionId: string;
  bankCode: string;
}

interface IdentityInitiateResponse {
  identityId: string;
  message: string;
}

export class SaveHavenService {
  private client: AxiosInstance;
  private provider = PROVIDERS.SAVEHAVEN;
  private accessToken: string | null = null;
  private tokenExpiry: number | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: this.provider.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
      validateStatus: () => true,
    });
  }

  // Exchange client assertion for access token
  private async authenticate(): Promise<string> {
    try {
      const response = await axios.post<TokenResponse>(
        `${this.provider.baseUrl}/oauth2/token`,
        {
          grant_type: "client_credentials",
          client_id: this.provider.clientId,
          client_assertion_type:
            "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
          client_assertion: this.provider.clientAssertion,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
          validateStatus: () => true,
        }
      );

      // Check for successful status code (200-299)
      if (response.status < 200 || response.status >= 300) {
        logger.error("SafeHaven authentication failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Authentication failed",
          response.status,
          ERROR_CODES.AUTHENTICATION_ERROR
        );
      }

      this.accessToken = response.data.access_token;
      this.tokenExpiry = Date.now() + response.data.expires_in * 1000;

      // Update default headers
      this.client.defaults.headers.common[
        "Authorization"
      ] = `Bearer ${this.accessToken}`;

      logger.info("SafeHaven authentication successful");
      return this.accessToken;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error("SafeHaven authentication error:", error.message);
      throw new AppError(
        "Authentication failed",
        401,
        ERROR_CODES.AUTHENTICATION_ERROR
      );
    }
  }

  // Ensure valid token before making requests
  private async ensureAuthenticated(): Promise<void> {
    if (
      !this.accessToken ||
      !this.tokenExpiry ||
      Date.now() >= this.tokenExpiry - 60000 // Refresh 1 minute before expiry
    ) {
      await this.authenticate();
    }
  }

  // Helper to handle token expiration and retry
  private async executeWithAuth<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.ensureAuthenticated();
      return await operation();
    } catch (error: any) {
      const status = error.response?.status || error.status;

      // Token expired or unauthorized - retry once
      if (status === 401 || status === 403) {
        logger.info("Token expired or unauthorized, refreshing token...");

        this.accessToken = null;
        this.tokenExpiry = null;
        await this.ensureAuthenticated();

        logger.info("Retrying operation with new token...");
        return await operation();
      }
      throw error;
    }
  }

  // Helper to check if response is successful based on status code
  private isSuccessResponse(status: number): boolean {
    return status >= 200 && status < 300;
  }

  // Name Enquiry (Required before transfers)
  async nameEnquiry(
    accountNumber: string,
    bankCode: string
  ): Promise<NameEnquiryResponse> {
    return this.executeWithAuth(async () => {
      const response = await this.client.post("/transfers/name-enquiry", {
        accountNumber,
        bankCode,
      });

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        logger.error("Name enquiry failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Name enquiry failed",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Name enquiry successful: ${accountNumber}`);
      return {
        accountName: response.data.data.accountName,
        accountNumber: response.data.data.accountNumber,
        sessionId: response.data.data.sessionId,
        bankCode: response.data.data.bankCode,
      };
    });
  }

  // Get list of banks
  async getBanks(country: string = "NG"): Promise<SaveHavenBankData[]> {
    return this.executeWithAuth(async () => {
      const response = await this.client.get("/banks", {
        params: { country },
      });

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        logger.error("Failed to fetch banks:", {
          status: response.status,
          data: response.data,
          endpoint: "/banks",
          params: { country },
        });
        throw new AppError(
          response.data?.message || "Failed to fetch banks",
          response.status,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info(`Fetched banks for ${country}`);
      return response.data.data;
    });
  }

  // Initiate Identity Verification (Step 1)
  async initiateIdentityVerification(data: {
    identityType: "bvn" | "nin";
    identityNumber: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: string;
  }): Promise<{ identityId: string; message: string }> {
    return this.executeWithAuth(async () => {
      const payload = {
        type: data.identityType.toUpperCase(),
        number: data.identityNumber,
        debitAccountNumber: process.env.SAFEHAVEN_SWEEP_ACCOUNT,
      };

      const response = await this.client.post("/identity/v2", payload);

      logger.info("SafeHaven identity verification response:", {
        status: response.status,
        data: response.data,
      });

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        const errors = response.data?.error;

        // Handle array of errors
        if (Array.isArray(errors)) {
          throw new AppError(
            errors.join(", "),
            response.status,
            ERROR_CODES.VALIDATION_ERROR
          );
        }

        throw new AppError(
          response.data?.message || "Identity verification initiation failed",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const identityId = response.data.data?._id;

      return {
        identityId: identityId || "",
        message: response.data.message || "Record fetched successfully",
      };
    });
  }

  // Validate Identity with OTP (Step 2)
  async validateIdentity(data: {
    identityId: string;
    identificationType: string;
    otp: string;
  }): Promise<{ verified: boolean; message: string }> {
    return this.executeWithAuth(async () => {
      const response = await this.client.post("/identity/v2/validate", {
        identityId: data.identityId,
        type: data.identificationType,
        otp: data.otp,
      });

      logger.info("SaveHaven validation response:", {
        status: response.status,
        data: response.data,
      });

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        throw new AppError(
          response.data?.message || "Identity validation failed",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`✅ Identity validated successfully: ${data.identityId}`);
      return {
        verified: true,
        message: response.data.message || "Identity validated successfully",
      };
    });
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
    return this.executeWithAuth(async () => {
      const response = await this.client.post("/virtual-accounts", {
        validFor: 900,
        amountControl: "Fixed",
        externalReference: data.reference,
        email: data.email,
        callbackUrl: `${process.env.BASE_URL}/api/webhooks/savehaven/payment`,
      });

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
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

      logger.info(`Created virtual account for ${data.email}`);
      return response.data.data;
    });
  }

  // Create permanent sub-account (requires prior identity verification)
  async createSubAccount(data: {
    externalReference: string;
    phoneNumber: string;
    emailAddress: string;
    identityId: string; // Must be from verified identity
  }): Promise<SaveHavenAccountData> {
    return this.executeWithAuth(async () => {
      const payload = {
        externalReference: data.externalReference,
        phoneNumber: data.phoneNumber,
        emailAddress: data.emailAddress,
        identityId: data.identityId,
        callbackUrl: `${process.env.APP_URL}/api/webhooks/savehaven/subaccount`,
        autoSweep: false,
      };

      logger.info("Creating sub-account with payload:", payload);

      const response = await this.client.post(
        "/accounts/v2/subaccount",
        payload
      );

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        logger.error("Failed to create sub-account:", {
          status: response.status,
          data: response.data,
        });

        if (response.status === 403) {
          throw new AppError(
            "Access forbidden. Check API credentials or account permissions.",
            403,
            ERROR_CODES.AUTHENTICATION_ERROR
          );
        }

        throw new AppError(
          response.data?.message || "Failed to create sub-account",
          response.status,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Created sub-account for ${data.emailAddress}`);
      return response.data.data;
    });
  }

  // Verify payment/transaction (for wallet funding confirmation)
  async verifyPayment(reference: string): Promise<any> {
    return this.executeWithAuth(async () => {
      const response = await this.client.get(
        `/transaction/verify/${reference}`
      );

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        logger.error("Payment verification failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Payment verification failed",
          response.status,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      logger.info(`Verified payment: ${reference}`);
      return response.data.data;
    });
  }

  // Initiate transfer/payout (FIXED: uses correct endpoint and requires sessionId)
  async initiateTransfer(data: {
    amount: number;
    account_number: string;
    bank_code: string;
    narration: string;
    reference: string;
    sessionId?: string; // Optional - will do name enquiry if not provided
  }): Promise<any> {
    return this.executeWithAuth(async () => {
      // If no sessionId provided, do name enquiry first
      let sessionId = data.sessionId;
      if (!sessionId) {
        const enquiry = await this.nameEnquiry(
          data.account_number,
          data.bank_code
        );
        sessionId = enquiry.sessionId;
        logger.info(`Name enquiry completed, sessionId: ${sessionId}`);
      }

      // Now initiate transfer with sessionId
      const response = await this.client.post("/transfers", {
        amount: data.amount,
        narration: data.narration,
        sessionId: sessionId,
        callbackUrl: `${process.env.BASE_URL}/api/webhooks/savehaven/transfer`,
      });

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        logger.error("Transfer failed:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Transfer failed",
          response.status,
          ERROR_CODES.SERVICE_UNAVAILABLE
        );
      }

      logger.info(`Initiated transfer: ${data.reference}`);
      return response.data.data;
    });
  }

  // Get account transactions
  async getTransactions(data: {
    accountNumber?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    pageSize?: number;
  }): Promise<any> {
    return this.executeWithAuth(async () => {
      const response = await this.client.get("/transactions", {
        params: {
          accountNumber: data.accountNumber,
          startDate: data.startDate,
          endDate: data.endDate,
          page: data.page || 1,
          pageSize: data.pageSize || 50,
        },
      });

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        logger.error("Failed to fetch transactions:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to fetch transactions",
          response.status,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info("Fetched transactions");
      return response.data.data;
    });
  }

  // Get account balance
  async getAccountBalance(accountNumber: string): Promise<number> {
    return this.executeWithAuth(async () => {
      const response = await this.client.get(
        `/accounts/${accountNumber}/balance`
      );

      // Check HTTP status code for success
      if (!this.isSuccessResponse(response.status)) {
        logger.error("Failed to get balance:", {
          status: response.status,
          data: response.data,
        });
        throw new AppError(
          response.data?.message || "Failed to get balance",
          response.status,
          ERROR_CODES.THIRD_PARTY_ERROR
        );
      }

      logger.info(`Fetched balance for account: ${accountNumber}`);
      return response.data.data.availableBalance || response.data.data.balance;
    });
  }
}
