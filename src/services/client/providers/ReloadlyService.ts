import axios, { AxiosInstance } from "axios";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { GiftCardOrderData, InternationalAirtimeData, InternationalDataData, ProviderResponse, UtilityPaymentData } from "@/types";

interface ReloadlyAuthResponse {
  access_token: string;
  scope: string;
  expires_in: number;
  token_type: string;
}

export class ReloadlyService {
  private airtimeClient: AxiosInstance;
  private giftCardClient: AxiosInstance;
  private utilityClient: AxiosInstance;
  private authClient: AxiosInstance;
  private airtimeBaseUrl: string;
  private giftCardBaseUrl: string;
  private utilityBaseUrl: string;
  private authBaseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private isSandbox: boolean;

  // Token cache for all three APIs
  private airtimeToken: string | null = null;
  private airtimeTokenExpiry: number = 0;
  private giftCardToken: string | null = null;
  private giftCardTokenExpiry: number = 0;
  private utilityToken: string | null = null;
  private utilityTokenExpiry: number = 0;

  constructor() {
    // Get configuration from environment variables
    this.clientId = process.env.RELOADLY_CLIENT_ID || "";
    this.clientSecret = process.env.RELOADLY_CLIENT_SECRET || "";
    this.isSandbox = process.env.RELOADLY_SANDBOX === "true";

    // Set base URLs based on environment
    this.authBaseUrl = "https://auth.reloadly.com";
    this.airtimeBaseUrl = this.isSandbox
      ? "https://topups-sandbox.reloadly.com"
      : "https://topups.reloadly.com";
    this.giftCardBaseUrl = this.isSandbox
      ? "https://giftcards-sandbox.reloadly.com"
      : "https://giftcards.reloadly.com";
    this.utilityBaseUrl = this.isSandbox
      ? "https://utilities-sandbox.reloadly.com"
      : "https://utilities.reloadly.com";

    // Initialize auth client
    this.authClient = axios.create({
      baseURL: this.authBaseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Initialize airtime client (token will be set dynamically)
    this.airtimeClient = axios.create({
      baseURL: this.airtimeBaseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Initialize gift card client (token will be set dynamically)
    this.giftCardClient = axios.create({
      baseURL: this.giftCardBaseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Initialize utility client (token will be set dynamically)
    this.utilityClient = axios.create({
      baseURL: this.utilityBaseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // TOKEN MANAGEMEN

  // Get access token for Airtime API

  private async getAirtimeToken(): Promise<string> {
    if (this.airtimeToken && Date.now() < this.airtimeTokenExpiry) {
      return this.airtimeToken;
    }

    try {
      const response = await this.authClient.post<ReloadlyAuthResponse>(
        "/oauth/token",
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "client_credentials",
          audience: this.airtimeBaseUrl,
        }
      );

      this.airtimeToken = response.data.access_token;
      this.airtimeTokenExpiry =
        Date.now() + (response.data.expires_in - 300) * 1000;

      return this.airtimeToken;
    } catch (error: any) {
      logger.error("Reloadly airtime token generation failed", error);
      throw new AppError(
        "Failed to authenticate with Reloadly Airtime API",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get access token for Gift Card API

  private async getGiftCardToken(): Promise<string> {
    if (this.giftCardToken && Date.now() < this.giftCardTokenExpiry) {
      return this.giftCardToken;
    }

    try {
      const response = await this.authClient.post<ReloadlyAuthResponse>(
        "/oauth/token",
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "client_credentials",
          audience: this.giftCardBaseUrl,
        }
      );

      this.giftCardToken = response.data.access_token;
      this.giftCardTokenExpiry =
        Date.now() + (response.data.expires_in - 300) * 1000;

      return this.giftCardToken;
    } catch (error: any) {
      logger.error("Reloadly gift card token generation failed", error);
      throw new AppError(
        "Failed to authenticate with Reloadly Gift Card API",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get access token for Utility API

  private async getUtilityToken(): Promise<string> {
    if (this.utilityToken && Date.now() < this.utilityTokenExpiry) {
      return this.utilityToken;
    }

    try {
      const response = await this.authClient.post<ReloadlyAuthResponse>(
        "/oauth/token",
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: "client_credentials",
          audience: this.utilityBaseUrl,
        }
      );

      this.utilityToken = response.data.access_token;
      this.utilityTokenExpiry =
        Date.now() + (response.data.expires_in - 300) * 1000;

      return this.utilityToken;
    } catch (error: any) {
      logger.error("Reloadly utility token generation failed", error);
      throw new AppError(
        "Failed to authenticate with Reloadly Utility API",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // AIRTIME METHODS (ALSO HANDLES DATA BUNDLES
  // NOTE: Reloadly treats data bundles as part of airtime API
  // Operators with data: true or bundle: true offer data bundles

  // Get all countries for international airtime

  async getInternationalAirtimeCountries(): Promise<any> {
    try {
      const token = await this.getAirtimeToken();
      const response = await this.airtimeClient.get("/countries", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data.map((country: any) => ({
        isoName: country.isoName,
        name: country.name,
        currencyCode: country.currencyCode,
        currencyName: country.currencyName,
        currencySymbol: country.currencySymbol,
        flag: country.flag,
        callingCodes: country.callingCodes,
      }));
    } catch (error: any) {
      logger.error("Failed to get Reloadly countries", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch countries",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get operators by country code
  // Can filter for data operators by checking operator.data === true

  async getOperatorsByCountry(
    countryCode: string,
    includeDataOnly: boolean = false
  ): Promise<any> {
    try {
      const token = await this.getAirtimeToken();
      const response = await this.airtimeClient.get(
        `/operators/countries/${countryCode}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      let operators = response.data.map((operator: any) => ({
        operatorId: operator.operatorId,
        name: operator.name,
        bundle: operator.bundle,
        data: operator.data,
        denominationType: operator.denominationType,
        senderCurrencyCode: operator.senderCurrencyCode,
        senderCurrencySymbol: operator.senderCurrencySymbol,
        destinationCurrencyCode: operator.destinationCurrencyCode,
        destinationCurrencySymbol: operator.destinationCurrencySymbol,
        commission: operator.commission,
        minAmount: operator.minAmount,
        maxAmount: operator.maxAmount,
        localMinAmount: operator.localMinAmount,
        localMaxAmount: operator.localMaxAmount,
        fixedAmounts: operator.fixedAmounts,
        fixedAmountsDescriptions: operator.fixedAmountsDescriptions,
        logoUrls: operator.logoUrls,
        country: operator.country,
      }));

      // Filter for data operators if requested
      if (includeDataOnly) {
        operators = operators.filter(
          (op: any) => op.data === true || op.bundle === true
        );
      }

      return operators;
    } catch (error: any) {
      logger.error("Failed to get Reloadly operators", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch operators",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get data bundle operators by country
  // This is just a convenience method that filters operators with data support

  async getDataBundleOperators(countryCode: string): Promise<any> {
    return await this.getOperatorsByCountry(countryCode, true);
  }

  // Get operator by ID

  async getOperatorById(operatorId: string): Promise<any> {
    try {
      const token = await this.getAirtimeToken();
      const response = await this.airtimeClient.get(
        `/operators/${operatorId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get operator details", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch operator",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Auto-detect operator by phone number

  async detectOperator(phone: string, countryCode: string): Promise<any> {
    try {
      const token = await this.getAirtimeToken();
      const response = await this.airtimeClient.get(
        `/operators/auto-detect/phone/${phone}/countries/${countryCode}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error("Failed to detect operator", error);
      throw new AppError(
        error.response?.data?.message || "Failed to detect operator",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Purchase international airtime
  // NOTE: This same endpoint is used for data bundles!
  // Just use an operatorId that has data: true

  async purchaseInternationalAirtime(
    data: InternationalAirtimeData
  ): Promise<ProviderResponse> {
    try {
      const token = await this.getAirtimeToken();
      const response = await this.airtimeClient.post(
        "/topups",
        {
          operatorId: data.operatorId,
          amount: data.amount,
          useLocalAmount: false,
          customIdentifier: data.reference,
          recipientPhone: {
            countryCode: data.countryCode,
            number: data.phone,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const responseData = response.data;

      return {
        success: responseData.status === "SUCCESSFUL",
        pending:
          responseData.status === "PROCESSING" ||
          responseData.status === "PENDING",
        reference: data.reference,
        providerReference: responseData.transactionId?.toString(),
        status: responseData.status,
        message: this.getStatusMessage(responseData.status),
        data: responseData,
      };
    } catch (error: any) {
      return this.handleError(error, "International airtime purchase");
    }
  }

  // Purchase international data bundle
  // This is the SAME as purchaseInternationalAirtime
  // Reloadly uses the same endpoint for both

  async purchaseInternationalData(
    data: InternationalDataData
  ): Promise<ProviderResponse> {
    // Just call the airtime method - it's the same API!
    return await this.purchaseInternationalAirtime(data);
  }

  // Get transaction status (for async operations)

  async getAirtimeTransactionStatus(transactionId: string): Promise<any> {
    try {
      const token = await this.getAirtimeToken();
      const response = await this.airtimeClient.get(
        `/topups/${transactionId}/status`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get transaction status", error);
      throw new AppError(
        error.response?.data?.message || "Failed to get transaction status",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get account balance

  async getAirtimeBalance(): Promise<any> {
    try {
      const token = await this.getAirtimeToken();
      const response = await this.airtimeClient.get("/accounts/balance", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get account balance", error);
      throw new AppError(
        error.response?.data?.message || "Failed to get balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // GIFT CARD METHOD

  // Get all gift card products

  async getGiftCardProducts(filters?: {
    countryCode?: string;
    productName?: string;
    categoryId?: number;
    page?: number;
    size?: number;
  }): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const params: any = {};

      if (filters?.countryCode) params.countryCode = filters.countryCode;
      if (filters?.productName) params.productName = filters.productName;
      if (filters?.categoryId) params.productCategoryId = filters.categoryId;
      if (filters?.page) params.page = filters.page;
      if (filters?.size) params.size = filters.size;

      const response = await this.giftCardClient.get("/products", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card products", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch gift card products",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get gift card product by ID

  async getGiftCardProductById(productId: number): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const response = await this.giftCardClient.get(`/products/${productId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card product", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch gift card product",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get gift card products by country

  async getGiftCardProductsByCountry(countryCode: string): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const response = await this.giftCardClient.get(
        `/countries/${countryCode}/products`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card products by country", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch gift card products",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get gift card countries

  async getGiftCardCountries(): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const response = await this.giftCardClient.get("/countries", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card countries", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch countries",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get gift card categories

  async getGiftCardCategories(): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const response = await this.giftCardClient.get("/product-categories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card categories", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch categories",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get gift card discounts

  async getGiftCardDiscounts(productId?: number): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const url = productId ? `/products/${productId}/discounts` : "/discounts";

      const response = await this.giftCardClient.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card discounts", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch discounts",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Order/Purchase gift card

  async orderGiftCard(data: GiftCardOrderData): Promise<ProviderResponse> {
    try {
      const token = await this.getGiftCardToken();

      const payload: any = {
        productId: data.productId,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        customIdentifier: data.customIdentifier,
        senderName: data.senderName,
      };

      if (data.recipientEmail) {
        payload.recipientEmail = data.recipientEmail;
      }

      if (data.recipientPhoneDetails) {
        payload.recipientPhoneDetails = data.recipientPhoneDetails;
      }

      if (data.userId) {
        payload.productAdditionalRequirements = {
          userId: data.userId,
        };
      }

      const response = await this.giftCardClient.post("/orders", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseData = response.data;

      return {
        success: responseData.status === "SUCCESSFUL",
        pending:
          responseData.status === "PROCESSING" ||
          responseData.status === "PENDING",
        reference: data.customIdentifier,
        providerReference: responseData.transactionId?.toString(),
        status: responseData.status,
        message: this.getStatusMessage(responseData.status),
        data: responseData,
      };
    } catch (error: any) {
      return this.handleError(error, "Gift card purchase");
    }
  }

  // Get gift card redeem code

  async getGiftCardRedeemCode(transactionId: string): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const response = await this.giftCardClient.get(
        `/orders/transactions/${transactionId}/cards`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card redeem code", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch redeem code",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get gift card transaction

  async getGiftCardTransaction(transactionId: string): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const response = await this.giftCardClient.get(
        `/reports/transactions/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card transaction", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch transaction",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get FX rate for gift cards

  async getGiftCardFxRate(currencyCode: string, amount: number): Promise<any> {
    try {
      const token = await this.getGiftCardToken();
      const response = await this.giftCardClient.get("/fx-rate", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          currencyCode,
          amount,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get gift card FX rate", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch FX rate",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // UTILITY PAYMENT METHOD

  // Get all utility billers

  async getUtilityBillers(filters?: {
    type?: string;
    serviceType?: string;
    countryCode?: string;
    page?: number;
    size?: number;
  }): Promise<any> {
    try {
      const token = await this.getUtilityToken();
      const params: any = {};

      if (filters?.type) params.type = filters.type;
      if (filters?.serviceType) params.serviceType = filters.serviceType;
      if (filters?.countryCode) params.countryISOCode = filters.countryCode;
      if (filters?.page) params.page = filters.page;
      if (filters?.size) params.size = filters.size;

      const response = await this.utilityClient.get("/billers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params,
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get utility billers", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch billers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get biller by ID

  async getBillerById(billerId: number): Promise<any> {
    try {
      const token = await this.getUtilityToken();
      const response = await this.utilityClient.get(`/billers/${billerId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get biller details", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch biller",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Pay utility bill

  async payUtilityBill(data: UtilityPaymentData): Promise<ProviderResponse> {
    try {
      const token = await this.getUtilityToken();

      const payload: any = {
        subscriberAccountNumber: data.subscriberAccountNumber,
        amount: data.amount,
        billerId: data.billerId,
        referenceId: data.referenceId,
      };

      if (data.useLocalAmount !== undefined) {
        payload.useLocalAmount = data.useLocalAmount;
      }

      if (data.amountId) {
        payload.amountId = data.amountId;
      }

      if (data.additionalInfo) {
        payload.additionalInfo = data.additionalInfo;
      }

      const response = await this.utilityClient.post("/pay", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const responseData = response.data;

      return {
        success: responseData.status === "SUCCESSFUL",
        pending: responseData.status === "PROCESSING",
        reference: data.referenceId,
        providerReference: responseData.id?.toString(),
        status: responseData.status,
        message:
          responseData.message || this.getStatusMessage(responseData.status),
        data: responseData,
      };
    } catch (error: any) {
      return this.handleError(error, "Utility payment");
    }
  }

  // Get utility transaction

  async getUtilityTransaction(transactionId: string): Promise<any> {
    try {
      const token = await this.getUtilityToken();
      const response = await this.utilityClient.get(
        `/transactions/${transactionId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get utility transaction", error);
      throw new AppError(
        error.response?.data?.message || "Failed to fetch transaction",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get utility balance

  async getUtilityBalance(): Promise<any> {
    try {
      const token = await this.getUtilityToken();
      const response = await this.utilityClient.get("/accounts/balance", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: any) {
      logger.error("Failed to get utility balance", error);
      throw new AppError(
        error.response?.data?.message || "Failed to get balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // HELPER METHOD

  private getStatusMessage(status: string): string {
    const messages: { [key: string]: string } = {
      SUCCESSFUL: "Transaction completed successfully",
      PENDING: "Transaction is pending",
      PROCESSING: "Transaction is being processed",
      FAILED: "Transaction failed",
      REFUNDED: "Transaction was refunded",
    };

    return messages[status] || "Transaction status unknown";
  }

  private handleError(error: any, operationType: string): never {
    if (error instanceof AppError) {
      throw error;
    }

    if (error.response) {
      logger.error(`Reloadly ${operationType} error`, {
        status: error.response.status,
        data: error.response.data,
      });

      const errorMessage =
        error.response.data?.message ||
        error.response.data?.response_description ||
        `${operationType} failed`;

      throw new AppError(
        errorMessage,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } else {
      logger.error(`Reloadly ${operationType} error`, error.message);
      throw new AppError(
        `${operationType} failed`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }
}
