import axios, { AxiosInstance } from "axios";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { PROVIDERS } from "@/config";
import { AirtimeData, ProviderResponse, DataDataDTO, CableTvData, EducationData, ElectricityData, BettingData } from "@/types";


export class VTPassService {
  private client: AxiosInstance;
  private provider = PROVIDERS.VTPASS;

  constructor() {
    this.client = axios.create({
      baseURL: this.provider.baseUrl,
      headers: {
        "Content-Type": "application/json",
        "api-key": this.provider.apiKey,
        "secret-key": this.provider.secretKey,
      },
    });
  }

  // AIRTIME PURCHASE
  async purchaseAirtime(data: AirtimeData): Promise<ProviderResponse> {
    try {
      const response = await this.client.post("/pay", {
        request_id: data.reference,
        serviceID: data.network,
        amount: data.amount,
        phone: data.phone,
      });

      return this.handleTransactionResponse(response.data, "Airtime purchase");
    } catch (error: any) {
      return this.handleError(error, "Airtime purchase");
    }
  }

  // INTERNATIONAL AIRTIME METHODS
  async getInternationalAirtimeCountries(): Promise<any> {
    try {
      const response = await this.client.get(
        "/get-international-airtime-countries"
      );

      if (response.data.response_description === "000") {
        return response.data.content.countries.map((country: any) => ({
          iso2: country.code,
          name: country.name,
          flag: country.flag,
          iso3: country.currency,
          phoneCode: `+${country.prefix}`,
        }));
      }

      throw new AppError(
        "Failed to fetch international airtime countries",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "Failed to get international airtime countries",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Failed to fetch international airtime countries",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  async getInternationalAirtimeProductTypes(countryCode: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/get-international-airtime-product-types?code=${countryCode}`
      );

      if (response.data.response_description === "000") {
        return response.data.content.map((type: any) => ({
          productTypeId: type.product_type_id,
          name: type.name,
        }));
      }

      throw new AppError(
        "Failed to fetch product types",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "Failed to get international airtime product types",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Failed to fetch product types",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  async getInternationalAirtimeProviders(countryCode?: string): Promise<any> {
    try {
      if (!countryCode) {
        return [];
      }

      const response = await this.client.get(
        `/get-international-airtime-operators?code=${countryCode}&product_type_id=1`
      );

      if (response.data.response_description === "000") {
        return response.data.content.map((operator: any) => ({
          operatorId: operator.operator_id,
          name: operator.name,
          logo: operator.operator_image,
        }));
      }

      throw new AppError(
        "Failed to fetch international airtime providers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "Failed to get international airtime providers",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Failed to fetch international airtime providers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  async getInternationalAirtimeVariations(
    operatorId: string,
    productTypeId: number = 1
  ): Promise<any> {
    try {
      const response = await this.client.get(
        `/service-variations?serviceID=foreign-airtime&operator_id=${operatorId}&product_type_id=${productTypeId}`
      );

      if (response.data.response_description === "000") {
        return {
          serviceName: response.data.content.ServiceName,
          serviceId: response.data.content.serviceID,
          convenienceFee: response.data.content.convinience_fee,
          variations: response.data.content.variations.map(
            (variation: any) => ({
              variationCode: variation.variation_code,
              name: variation.name,
              amount: variation.variation_amount,
              fixedPrice: variation.fixedPrice,
            })
          ),
        };
      }

      throw new AppError(
        "Failed to fetch variations",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "Failed to get international airtime variations",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Failed to fetch variations",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  async purchaseInternationalAirtime(data: {
    phone: string;
    amount: number;
    countryCode: string;
    operatorId: string;
    variationCode: string;
    reference: string;
    email: string;
  }): Promise<ProviderResponse> {
    try {
      const response = await this.client.post("/pay", {
        request_id: data.reference,
        serviceID: "foreign-airtime",
        billersCode: data.phone,
        variation_code: data.variationCode,
        amount: data.amount,
        phone: data.phone,
        operator_id: data.operatorId,
        country_code: data.countryCode,
        product_type_id: "1",
        email: data.email,
      });

      return this.handleTransactionResponse(
        response.data,
        "International airtime purchase"
      );
    } catch (error: any) {
      return this.handleError(error, "International airtime purchase");
    }
  }

  // DATA PURCHASE
  async purchaseData(data: DataDataDTO): Promise<ProviderResponse> {
    try {
      const response = await this.client.post("/pay", {
        request_id: data.reference,
        serviceID: data.serviceCode,
        billersCode: data.phone,
        variation_code: data.variationCode,
        amount: data.amount,
        phone: data.phone,
      });

      return this.handleTransactionResponse(response.data, "Data purchase");
    } catch (error: any) {
      return this.handleError(error, "Data purchase");
    }
  }

  // INTERNATIONAL DATA METHODS
  async getInternationalDataCountries(): Promise<any> {
    return this.getInternationalAirtimeCountries();
  }

  async getInternationalDataProviders(countryCode?: string): Promise<any> {
    try {
      if (!countryCode) {
        return [];
      }

      const response = await this.client.get(
        `/get-international-airtime-operators?code=${countryCode}&product_type_id=4`
      );

      if (response.data.response_description === "000") {
        return response.data.content.map((operator: any) => ({
          operatorId: operator.operator_id,
          name: operator.name,
          image: operator.operator_image,
        }));
      }

      throw new AppError(
        "Failed to fetch international data providers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "Failed to get international data providers",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Failed to fetch international data providers",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  async getInternationalDataProducts(operator: string): Promise<any> {
    try {
      const response = await this.client.get(
        `/service-variations?serviceID=foreign-airtime&operator_id=${operator}&product_type_id=4`
      );

      if (response.data.response_description === "000") {
        return {
          serviceName: response.data.content.ServiceName,
          serviceId: response.data.content.serviceID,
          convenienceFee: response.data.content.convinience_fee,
          variations: response.data.content.variations.map(
            (variation: any) => ({
              variationCode: variation.variation_code,
              name: variation.name,
              amount: variation.variation_amount,
              fixedPrice: variation.fixedPrice,
            })
          ),
        };
      }

      throw new AppError(
        "Failed to fetch international data products",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "Failed to get international data products",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Failed to fetch international data products",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  async getInternationalDataProductDetails(
    variationCode: string,
    operatorId: string
  ): Promise<any> {
    try {
      const productsData = await this.getInternationalDataProducts(operatorId);
      const product = productsData.variations.find(
        (v: any) => v.variationCode === variationCode
      );

      if (!product) {
        throw new AppError(
          "Product not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      return {
        variationCode: product.variationCode,
        name: product.name,
        amount: parseFloat(product.amount) || 0,
        fixedPrice: product.fixedPrice,
      };
    } catch (error: any) {
      logger.error(
        "Failed to get international data product details",
        error.message
      );
      throw error;
    }
  }

  async purchaseInternationalData(data: {
    phone: string;
    amount: number;
    countryCode: string;
    operatorId: string;
    variationCode: string | undefined;
    reference: string;
    email: string;
  }): Promise<ProviderResponse> {
    try {
      const response = await this.client.post("/pay", {
        request_id: data.reference,
        serviceID: "foreign-airtime",
        billersCode: data.phone,
        variation_code: data.variationCode,
        amount: data.amount,
        phone: data.phone,
        operator_id: data.operatorId,
        country_code: data.countryCode,
        product_type_id: "4",
        email: data.email,
      });

      return this.handleTransactionResponse(
        response.data,
        "International data purchase"
      );
    } catch (error: any) {
      return this.handleError(error, "International data purchase");
    }
  }

  // CABLE TV PURCHASE
  async purchaseCableTv(data: CableTvData): Promise<ProviderResponse> {
    try {
      const response = await this.client.post("/pay", {
        request_id: data.reference,
        serviceID: data.provider,
        billersCode: data.smartCardNumber,
        variation_code: data.package,
        amount: data.amount,
        phone: data.phone,
        subscription_type: data.subscriptionType,
      });

      return this.handleTransactionResponse(
        response.data,
        "Cable TV subscription"
      );
    } catch (error: any) {
      return this.handleError(error, "Cable TV subscription");
    }
  }

  // EDUCATION/E-PIN PURCHASE
  async purchaseEducation(data: EducationData): Promise<ProviderResponse> {
    try {
      const response = await this.client.post("/pay", {
        request_id: data.reference,
        serviceID: "jamb",
        billersCode: data.profileId,
        variation_code: data.variationCode,
        amount: data.amount,
        phone: data.phone,
      });

      const result = this.handleTransactionResponse(
        response.data,
        "E-Pin purchase"
      );

      // Add token/PIN if available
      if (result.success && response.data.purchased_code) {
        result.token = response.data.purchased_code || response.data.Pin;
      }

      return result;
    } catch (error: any) {
      return this.handleError(error, "E-Pin purchase");
    }
  }

  // ELECTRICITY PURCHASE
  async purchaseElectricity(data: ElectricityData): Promise<ProviderResponse> {
    try {
      const response = await this.client.post("/pay", {
        request_id: data.reference,
        serviceID: data.productCode,
        billersCode: data.meterNumber,
        variation_code: data.meterType,
        amount: data.amount,
        phone: data.phone,
      });

      const result = this.handleTransactionResponse(
        response.data,
        "Electricity payment"
      );

      // Add token if available
      if (result.success && response.data.content?.token) {
        result.token =
          response.data.content?.token || response.data.purchased_code;
      }

      return result;
    } catch (error: any) {
      return this.handleError(error, "Electricity payment");
    }
  }

  // BETTING FUNDING
  async fundBetting(data: BettingData): Promise<ProviderResponse> {
    try {
      const requestId = `BET_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 11)}`;

      const response = await this.client.post("/pay", {
        request_id: requestId,
        serviceID: data.provider,
        billersCode: data.customerId,
        amount: data.amount,
      });

      const result = this.handleTransactionResponse(
        response.data,
        "Betting funding"
      );
      result.reference = requestId;

      return result;
    } catch (error: any) {
      return this.handleError(error, "Betting funding");
    }
  }

  // VERIFICATION METHODS
  async verifySmartCard(
    smartCardNumber: string,
    provider: string
  ): Promise<any> {
    try {
      const response = await this.client.post("/merchant-verify", {
        billersCode: smartCardNumber,
        serviceID: provider,
      });

      return this.handleVerificationResponse(
        response.data,
        "Smart card verification"
      );
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        "Smart card verification error",
        error.response?.data || error.message
      );

      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Smart card verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  async verifyMeterNumber(
    meterNumber: string,
    provider: string,
    meterType: string
  ): Promise<any> {
    try {
      const response = await this.client.post("/merchant-verify", {
        billersCode: meterNumber,
        serviceID: provider,
        type: meterType,
      });

      const result = this.handleVerificationResponse(
        response.data,
        "Meter verification"
      );

      // Add meter-specific fields
      if (result.valid) {
        result.address = response.data.content?.Address;
        result.meterNumber = response.data.content?.MeterNumber;
        result.meterType = response.data.content?.Meter_Type;
      }

      return result;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        "Meter verification error",
        error.response?.data || error.message
      );

      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Meter verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  async verifyJambProfile(profileId: string, type: string): Promise<any> {
    try {
      const response = await this.client.post("/merchant-verify", {
        billersCode: profileId,
        serviceID: "jamb",
        type,
      });

      const result = this.handleVerificationResponse(
        response.data,
        "Profile verification"
      );

      // Add profile-specific fields
      if (result.valid) {
        result.registrationNumber = profileId;
      }

      return result;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        "JAMB profile verification error",
        error.response?.data || error.message
      );

      throw new AppError(
        error.response?.data?.response_description ||
          error.message ||
          "Profile verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // HELPER METHODS - Centralized response handling
  private handleTransactionResponse(
    responseData: any,
    operationType: string
  ): ProviderResponse {
    const code = responseData.code;
    const transactionStatus = responseData?.content?.transactions?.status;

    // Handle code 099 - Transaction is processing
    if (code === "099") {
      logger.info(`VTPass ${operationType} transaction processing`, {
        code: code,
        requestId: responseData.requestId,
        description: responseData.response_description,
      });

      return {
        success: false,
        pending: true,
        providerReference: responseData.requestId || responseData.transactionId,
        message:
          responseData.response_description || "Transaction is processing",
        data: responseData.content,
      };
    }

    // Handle failed transactions (not code 000)
    if (code !== "000") {
      logger.error(`VTPass ${operationType} transaction failed`, {
        code: code,
        description: responseData.response_description,
        requestId: responseData.requestId,
      });

      throw new AppError(
        responseData.response_description || `${operationType} failed`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    // Code is 000, check transaction status
    if (transactionStatus === "delivered") {
      return {
        success: true,
        pending: false,
        status: transactionStatus,
        providerReference: responseData.requestId || responseData.transactionId,
        message:
          responseData.response_description || `${operationType} successful`,
        data: responseData.content,
      };
    } else if (
      transactionStatus === "pending" ||
      transactionStatus === "initiated"
    ) {
      logger.info(`VTPass ${operationType} transaction pending`, {
        status: transactionStatus,
        requestId: responseData.requestId,
      });

      return {
        success: false,
        pending: true,
        status: transactionStatus,
        providerReference: responseData.requestId || responseData.transactionId,
        message: "Transaction is being processed",
        data: responseData.content,
      };
    }

    logger.warn(`VTPass ${operationType} unexpected transaction status`, {
      code: code,
      status: transactionStatus,
      requestId: responseData.requestId,
    });

    return {
      success: false,
      pending: true,
      status: transactionStatus,
      providerReference: responseData.requestId || responseData.transactionId,
      message: "Transaction status unclear, please requery",
      data: responseData.content,
    };
  }

  private handleVerificationResponse(
    responseData: any,
    operationType: string
  ): any {
    const code = responseData.code;

    if (code === "020" || code === "000") {
      if (responseData.content?.error) {
        throw new AppError(
          responseData.content?.error,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      return {
        valid: true,
        customerName: responseData.content?.Customer_Name,
        status: responseData.content?.Status,
        smartCardNumber: responseData.content?.Customer_Number,
        dueDate: responseData.content?.Due_Date,
      };
    }

    // Handle specific error codes
    if (code === "011") {
      throw new AppError(
        "Invalid arguments provided for verification",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (code === "012") {
      throw new AppError(
        "Service does not exist",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (code === "030") {
      throw new AppError(
        "Service provider is currently unavailable",
        HTTP_STATUS.SERVICE_UNAVAILABLE,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    throw new AppError(
      responseData.response_description || `${operationType} failed`,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR
    );
  }

  private handleError(error: any, operationType: string): never {
    if (error instanceof AppError) {
      throw error;
    }

    if (error.response) {
      logger.error(`VTPass ${operationType} error`, {
        status: error.response.status,
        data: error.response.data,
      });
    } else {
      logger.error(`VTPass ${operationType} error`, error.message);
    }

    throw new AppError(
      error.response?.data?.response_description ||
        error.message ||
        `${operationType} failed`,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.PROVIDER_ERROR
    );
  }
}
