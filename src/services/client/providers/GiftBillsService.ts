import axios, { AxiosInstance } from "axios";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { PROVIDERS } from "@/config";
import { AirtimeData, ProviderResponse, DataDataDTO, BettingData } from "@/types";


export class GiftBillsService {
  private client: AxiosInstance;
  private provider = PROVIDERS.GIFTBILLS;

  constructor() {
    this.client = axios.create({
      baseURL: this.provider.baseUrl,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.provider.apiKey}`,
        MerchantId: this.provider.merchantId,
      },
    });
  }

  // ============= AIRTIME SERVICES =============

  /**
   * Get all available airtime providers
   */
  async getAirtimeProviders(): Promise<any> {
    try {
      const response = await this.client.get("/airtime");

      if (response.data.success && response.data.code === "00000") {
        return response.data.data.map((provider: any) => ({
          provider: provider.provider,
          logoUrl: provider.providerLogoUrl,
          minAmount: provider.minAmount,
          maxAmount: provider.maxAmount,
        }));
      }

      throw new AppError(
        response.data.message || "Failed to fetch airtime providers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Failed to get airtime providers",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Failed to fetch airtime providers");
    }
  }

  /**
   * Purchase airtime
   */
  async purchaseAirtime(data: AirtimeData): Promise<ProviderResponse> {
    try {
      const payload = {
        provider: data.network.toUpperCase(),
        number: data.phone,
        amount: data.amount.toString(),
        reference: data.reference,
      };

      logger.info("GiftBills: Purchasing airtime", payload);

      const response = await this.client.post("/airtime/topup", payload);

      return this.handleTransactionResponse(
        response.data,
        "Airtime purchase",
        data.reference
      );
    } catch (error: any) {
      return this.handleError(error, "Airtime purchase");
    }
  }

  // ============= DATA SERVICES =============

  /**
   * Get all available internet/data providers
   */
  async getDataProviders(): Promise<any> {
    try {
      const response = await this.client.get("/internet");

      if (response.data.success && response.data.code === "00000") {
        return response.data.data.map((provider: any) => ({
          id: provider.id,
          provider: provider.provider,
          logoUrl: provider.providerLogoUrl,
        }));
      }

      throw new AppError(
        response.data.message || "Failed to fetch data providers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Failed to get data providers",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Failed to fetch data providers");
    }
  }

  /**
   * Get all available data types
   */
  async getDataTypes(): Promise<any> {
    try {
      const response = await this.client.get("/internet/data_types");

      if (response.data.success && response.data.code === "00000") {
        return response.data.data.map((dataType: any) => ({
          id: dataType.id,
          ipId: dataType.ip_id,
          name: dataType.name,
        }));
      }

      throw new AppError(
        response.data.message || "Failed to fetch data types",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Failed to get data types",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Failed to fetch data types");
    }
  }

  /**
   * Get data plans for a specific provider
   * @param provider - Provider name (e.g., "MTN", "AIRTEL", "GLO", "9MOBILE")
   */
  async getDataPlans(provider: string): Promise<any> {
    try {
      const response = await this.client.get(`/internet/plans/${provider}`);

      if (response.data.success && response.data.code === "00000") {
        return response.data.data.map((plan: any) => ({
          id: plan.id,
          dataTypeId: plan.data_type_id,
          name: plan.name,
          amount: plan.amount,
          discount: plan.api_cent,
        }));
      }

      throw new AppError(
        response.data.message || "Failed to fetch data plans",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Failed to get data plans",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Failed to fetch data plans");
    }
  }

  /**
   * Purchase data
   */
  async purchaseData(data: DataDataDTO): Promise<ProviderResponse> {
    try {
      // Extract provider ID or name from productCode or provider field
      const providerId = data.productCode || data.provider || data.serviceCode;
      
      if (!providerId) {
        throw new AppError(
          "Provider information is required",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const payload = {
        provider: providerId,
        number: data.phone,
        plan_id: data.plan,
        reference: data.reference,
      };

      logger.info("GiftBills: Purchasing data", payload);

      const response = await this.client.post("/internet/data", payload);

      return this.handleTransactionResponse(
        response.data,
        "Data purchase",
        data.reference || ""
      );
    } catch (error: any) {
      return this.handleError(error, "Data purchase");
    }
  }

  // ============= BETTING SERVICES =============

  /**
   * Get all available betting providers
   */
  async getBettingProviders(): Promise<any> {
    try {
      const response = await this.client.get("/betting");

      if (response.data.success && response.data.code === "00000") {
        return response.data.data.map((provider: any) => ({
          provider: provider.provider,
          logoUrl: provider.providerLogoUrl,
          minAmount: provider.minAmount,
          maxAmount: provider.maxAmount,
        }));
      }

      throw new AppError(
        response.data.message || "Failed to fetch betting providers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Failed to get betting providers",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Failed to fetch betting providers");
    }
  }

  /**
   * Validate betting customer ID
   */
  async validateBettingCustomer(
    customerId: string,
    provider: string
  ): Promise<any> {
    try {
      const payload = {
        provider: provider.toUpperCase(),
        customerId: customerId,
      };

      logger.info("GiftBills: Validating betting customer", payload);

      const response = await this.client.post("/betting/validate", payload);

      if (response.data.success && response.data.code === "00000") {
        return {
          valid: true,
          provider: response.data.data.provider,
          customerId: response.data.data.customerId,
          firstName: response.data.data.firstName,
          lastName: response.data.data.lastName,
          userName: response.data.data.userName,
        };
      }

      throw new AppError(
        response.data.message || "Customer validation failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Betting customer validation error",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Customer validation failed");
    }
  }

  /**
   * Fund betting account
   */
  async fundBetting(data: BettingData): Promise<ProviderResponse> {
    try {
      const payload = {
        provider: data.provider.toUpperCase(),
        customerId: data.customerId,
        amount: data.amount.toString(),
        reference: `BET_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      };

      // Generate HMAC SHA512 signature for encryption header
      // Note: This requires the encryption key from the provider config
      const signature = this.generateSignature(payload);

      logger.info("GiftBills: Funding betting account", payload);

      const response = await this.client.post("/betting/topup", payload, {
        headers: {
          Encryption: signature,
        },
      });

      return this.handleTransactionResponse(
        response.data,
        "Betting funding",
        payload.reference
      );
    } catch (error: any) {
      return this.handleError(error, "Betting funding");
    }
  }

  /**
   * Check betting transaction status
   */
  async checkBettingStatus(orderNo: string, reference: string): Promise<any> {
    try {
      const payload = {
        orderNo: orderNo,
        reference: reference,
        serviceType: "betting",
      };

      logger.info("GiftBills: Checking betting transaction status", payload);

      const response = await this.client.post("/betting/status", payload);

      if (response.data.success && response.data.code === "00000") {
        return {
          orderNo: response.data.data.orderNo,
          reference: response.data.data.reference,
          status: response.data.data.status,
          errorMsg: response.data.data.errorMsg,
        };
      }

      throw new AppError(
        response.data.message || "Failed to check transaction status",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Failed to check betting status",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Failed to check transaction status");
    }
  }

  // ============= TRANSACTION STATUS METHODS =============

  /**
   * Get transaction history
   */
  async getTransactionHistory(): Promise<any> {
    try {
      const response = await this.client.get("/bill/history");

      if (response.data.success && response.data.code === "00000") {
        return {
          transactions: response.data.data,
          totalCount: response.data.total_count,
        };
      }

      throw new AppError(
        response.data.message || "Failed to fetch transaction history",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Failed to get transaction history",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Failed to fetch transaction history");
    }
  }

  /**
   * Get specific transaction status by orderNo
   */
  async getTransactionStatus(orderNo: string): Promise<any> {
    try {
      const response = await this.client.get(`/bill/status/${orderNo}`);

      if (response.data.success && response.data.code === "00000") {
        return response.data.data;
      }

      throw new AppError(
        response.data.message || "Failed to fetch transaction status",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "GiftBills: Failed to get transaction status",
        error.response?.data || error.message
      );
      throw this.handleError(error, "Failed to fetch transaction status");
    }
  }

  // ============= HELPER METHODS =============

  /**
   * Handle transaction response from GiftBills
   */
  private handleTransactionResponse(
    responseData: any,
    operationType: string,
    reference: string
  ): ProviderResponse {
    // Check if request was successful
    if (!responseData.success || responseData.code !== "00000") {
      logger.error(`GiftBills ${operationType} failed`, {
        code: responseData.code,
        message: responseData.message,
      });

      throw new AppError(
        responseData.message || `${operationType} failed`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    const data = responseData.data;
    const status = data.status?.toLowerCase();

    // Map GiftBills status to our standard format
    const isPending = status === "pending";
    const isSuccess = status === "delivered" || status === "successful" || status === "success";
    const isFailed = status === "failed" || status === "fail";

    if (isFailed) {
      throw new AppError(
        data.errorMsg || `${operationType} failed`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    logger.info(`GiftBills ${operationType} response`, {
      status: status,
      orderNo: data.orderNo,
      reference: data.reference,
    });

    return {
      success: isSuccess,
      pending: isPending,
      status: status,
      reference: data.reference || reference,
      providerReference: data.orderNo,
      message: data.errorMsg || responseData.message || `${operationType} processed`,
      data: data,
    };
  }

  /**
   * Generate HMAC SHA512 signature for betting transactions
   */
  private generateSignature(payload: any): string {
    const crypto = require("crypto");
    
    // Sort payload keys alphabetically
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce((acc: any, key: string) => {
        acc[key] = payload[key];
        return acc;
      }, {});

    // Convert to string
    const payloadString = JSON.stringify(sortedPayload);

    // Generate HMAC SHA512 signature
    const signature = crypto
      .createHmac("sha512", this.provider.encryptionKey || "")
      .update(payloadString)
      .digest("hex");

    return signature;
  }

  /**
   * Handle errors from GiftBills API
   */
  private handleError(error: any, operationType: string): never {
    if (error instanceof AppError) {
      throw error;
    }

    const errorData = error.response?.data;

    if (errorData) {
      logger.error(`GiftBills ${operationType} error`, {
        status: error.response.status,
        code: errorData.code,
        message: errorData.message,
      });

      throw new AppError(
        errorData.message || `${operationType} failed`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    logger.error(`GiftBills ${operationType} error`, error.message);

    throw new AppError(
      error.message || `${operationType} failed`,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.PROVIDER_ERROR
    );
  }
}