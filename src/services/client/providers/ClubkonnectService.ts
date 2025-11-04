import axios, { AxiosInstance } from "axios";
import { Product } from "@/models/reference/Product";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { PROVIDERS } from "@/config";

interface ProviderResponse {
  success: boolean;
  pending?: boolean;
  reference?: string;
  status?: string;
  providerReference?: string;
  message: string;
  data?: any;
  token?: string;
}

interface AirtimeData {
  phone: string;
  amount: number;
  network: string;
  reference: string;
}

interface DataDataDTO {
  phone: string;
  amount: number;
  provider?: string;
  plan: string;
  productCode?: string;
  serviceCode?: string;
  variationCode?: string;
  reference: string;
}

interface CableTvData {
  smartCardNumber: string;
  amount: number;
  provider: string;
  package: string;
  reference: string;
  phone?: string;
  subscriptionType: "renew" | "change";
}

interface ElectricityData {
  reference: string;
  meterNumber: string;
  amount: number;
  provider: string;
  meterType: string;
  productCode: string;
  phone: string;
}

interface BettingData {
  customerId: string;
  amount: number;
  provider: string;
}

export class ClubKonnectService {
  private client: AxiosInstance;
  private provider = PROVIDERS.CLUBKONNECT;

  constructor() {
    this.client = axios.create({
      baseURL: this.provider.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  // AIRTIME PURCHASE
  async purchaseAirtime(data: AirtimeData): Promise<ProviderResponse> {
    try {
      const networkCode = this.getNetworkCode(data.network);

      const response = await this.client.get("/APIAirtimeV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          MobileNetwork: networkCode,
          Amount: data.amount,
          MobileNumber: data.phone,
          RequestID: data.reference,
        },
      });

      return this.handleResponse(
        response.data,
        data.reference,
        "Airtime purchase"
      );
    } catch (error: any) {
      return this.handleError(error, "Airtime purchase");
    }
  }

  // DATA PURCHASE
  async purchaseData(data: DataDataDTO): Promise<ProviderResponse> {
    try {
      // Get product details to retrieve ClubKonnect data plan code
      const product = await Product.findOne({
        code: data.plan,
        isActive: true,
      }).populate({
        path: "serviceId",
        select: "code",
      });

      if (!product) {
        throw new AppError(
          "Product not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      // Get ClubKonnect data plan code (fallback to main code if not available)
      const dataPlanCode = product.providerCodes?.clubkonnect || product.code;

      // Extract network from service code (e.g., "mtn-data" -> "mtn")
      const serviceCode = (product.serviceId as any).code || "";
      const network = serviceCode.split("-")[0];

      if (!network) {
        throw new AppError(
          "Cannot determine network from product",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const networkCode = this.getNetworkCode(network);

      const response = await this.client.get("/APIDatabundleV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          MobileNetwork: networkCode,
          DataPlan: dataPlanCode,
          MobileNumber: data.phone,
          RequestID: data.reference,
        },
      });

      return this.handleResponse(
        response.data,
        data.reference,
        "Data purchase"
      );
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      return this.handleError(error, "Data purchase");
    }
  }

  // CABLE TV PURCHASE
  async purchaseCableTv(data: CableTvData): Promise<ProviderResponse> {
    try {
      // Get product details to retrieve ClubKonnect package code
      const product = await Product.findOne({
        code: data.package,
        isActive: true,
      }).populate({
        path: "serviceId",
        select: "code",
      });

      if (!product) {
        throw new AppError(
          "Package not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      // Get ClubKonnect package code (fallback to main code if not available)
      const packageCode = product.providerCodes?.clubkonnect || product.code;

      // Get CableTV code from provider
      const cableTvCode = this.getCableTvCode(data.provider);

      const response = await this.client.get("/APICableTVV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          CableTV: cableTvCode,
          Package: packageCode,
          SmartCardNo: data.smartCardNumber,
          PhoneNo: data.phone || "",
          RequestID: data.reference,
        },
      });

      return this.handleResponse(
        response.data,
        data.reference,
        "Cable TV subscription"
      );
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      return this.handleError(error, "Cable TV subscription");
    }
  }

  // ELECTRICITY PURCHASE
  async purchaseElectricity(data: ElectricityData): Promise<ProviderResponse> {
    try {
      // Get electric company code
      const electricCompanyCode = this.getElectricCompanyCode(data.provider);

      // Get meter type code
      const meterTypeCode = this.getMeterTypeCode(data.meterType);

      const response = await this.client.get("/APIElectricityV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          ElectricCompany: electricCompanyCode,
          MeterType: meterTypeCode,
          MeterNo: data.meterNumber,
          Amount: data.amount,
          PhoneNo: data.phone,
          RequestID: data.reference,
        },
      });

      const result = this.handleResponse(
        response.data,
        data.reference,
        "Electricity payment"
      );

      // Add meter token if available
      if (result.success && response.data.metertoken) {
        result.token = response.data.metertoken;
      }

      return result;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      return this.handleError(error, "Electricity payment");
    }
  }

  // BETTING FUNDING
  async fundBetting(data: BettingData): Promise<ProviderResponse> {
    try {
      // Get betting company code
      const bettingCompanyCode = this.getBettingCompanyCode(data.provider);

      const requestId = `BET_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 11)}`;

      const response = await this.client.get("/APIBettingV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          BettingCompany: bettingCompanyCode,
          CustomerID: data.customerId,
          Amount: data.amount,
          RequestID: requestId,
        },
      });

      const result = this.handleResponse(
        response.data,
        requestId,
        "Betting funding"
      );
      result.reference = requestId;

      return result;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      return this.handleError(error, "Betting funding");
    }
  }

  // VERIFY SMART CARD
  async verifySmartCard(
    smartCardNumber: string,
    provider: string
  ): Promise<any> {
    try {
      const cableTvCode = this.getCableTvCode(provider);

      const response = await this.client.get("/APIVerifyCableTVV1.0.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          CableTV: cableTvCode,
          SmartCardNo: smartCardNumber,
        },
      });

      const customerName = response.data.customer_name;

      if (
        !customerName ||
        customerName === "INVALID_SMARTCARDNO" ||
        customerName.includes("INVALID")
      ) {
        throw new AppError(
          "Invalid smart card number",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      return {
        valid: true,
        customerName: customerName,
        smartCardNumber: smartCardNumber,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        "ClubKonnect smart card verification error",
        error.response?.data || error.message
      );

      throw new AppError(
        error.response?.data?.customer_name || "Smart card verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // VERIFY METER NUMBER
  async verifyMeterNumber(meterNumber: string, provider: string): Promise<any> {
    try {
      const electricCompanyCode = this.getElectricCompanyCode(provider);

      const response = await this.client.get("/APIVerifyElectricityV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          ElectricCompany: electricCompanyCode,
          MeterNo: meterNumber,
        },
      });

      const customerName = response.data.customer_name;

      if (
        !customerName ||
        customerName === "INVALID_METERNO" ||
        customerName.includes("INVALID")
      ) {
        throw new AppError(
          "Invalid meter number",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      return {
        valid: true,
        customerName: customerName,
        meterNumber: meterNumber,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        "ClubKonnect meter verification error",
        error.response?.data || error.message
      );

      throw new AppError(
        error.response?.data?.customer_name || "Meter verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // VERIFY BETTING CUSTOMER ID
  async verifyBettingCustomer(
    customerId: string,
    provider: string
  ): Promise<any> {
    try {
      const bettingCompanyCode = this.getBettingCompanyCode(provider);

      const response = await this.client.get("/APIVerifyBettingV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          BettingCompany: bettingCompanyCode,
          CustomerID: customerId,
        },
      });

      const customerName = response.data.customer_name;

      if (
        !customerName ||
        customerName.includes("Error") ||
        customerName.includes("Invalid")
      ) {
        throw new AppError(
          "Invalid customer ID",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      return {
        valid: true,
        customerName: customerName,
        customerId: customerId,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        "ClubKonnect betting customer verification error",
        error.response?.data || error.message
      );

      throw new AppError(
        error.response?.data?.customer_name || "Customer verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  // QUERY TRANSACTION
  async queryTransaction(
    orderIdOrReference: string,
    isOrderId: boolean = true
  ): Promise<any> {
    try {
      const params: any = {
        UserID: this.provider.userId,
        APIKey: this.provider.apiKey,
      };

      if (isOrderId) {
        params.OrderID = orderIdOrReference;
      } else {
        params.RequestID = orderIdOrReference;
      }

      const response = await this.client.get("/APIQueryV1.asp", {
        params,
      });

      return response.data;
    } catch (error: any) {
      logger.error(
        "ClubKonnect query transaction error",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.status || "Query transaction failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // CANCEL TRANSACTION
  async cancelTransaction(orderId: string): Promise<any> {
    try {
      const response = await this.client.get("/APICancelV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          OrderID: orderId,
        },
      });

      if (response.data.status === "ORDER_CANCELLED") {
        return {
          success: true,
          message: "Transaction cancelled successfully",
          orderid: response.data.orderid,
        };
      }

      throw new AppError(
        "Failed to cancel transaction",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    } catch (error: any) {
      logger.error(
        "ClubKonnect cancel transaction error",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.status || "Cancel transaction failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Handle ClubKonnect Response - Centralized response handling
  private handleResponse(
    responseData: any,
    reference: string,
    operationType: string
  ): ProviderResponse {
    const statusCode = parseInt(responseData.statuscode || "0");
    const status = responseData.status || "";

    logger.info(`ClubKonnect ${operationType} response`, {
      statusCode,
      status,
      orderid: responseData.orderid,
    });

    // SUCCESS: 200 - ORDER_COMPLETED
    if (statusCode === 200 && status === "ORDER_COMPLETED") {
      return {
        success: true,
        pending: false,
        reference: reference,
        providerReference: responseData.orderid,
        status: status,
        message: responseData.remark || `${operationType} successful`,
        data: responseData,
      };
    }

    // PENDING: 100 - ORDER_RECEIVED
    if (statusCode === 100 && status === "ORDER_RECEIVED") {
      return {
        success: false,
        pending: true,
        reference: reference,
        providerReference: responseData.orderid,
        status: status,
        message: "Order received and awaiting processing",
        data: responseData,
      };
    }

    // PENDING: 300 - ORDER_PROCESSED (Awaiting network response)
    if (statusCode === 300 && status === "ORDER_PROCESSED") {
      return {
        success: false,
        pending: true,
        reference: reference,
        providerReference: responseData.orderid,
        status: status,
        message: "Transaction sent, awaiting network response",
        data: responseData,
      };
    }

    // PENDING: 201 - ORDER_COMPLETED but Network Unresponsive
    if (statusCode === 201 && status === "ORDER_COMPLETED") {
      return {
        success: false,
        pending: true,
        reference: reference,
        providerReference: responseData.orderid,
        status: status,
        message:
          "Transaction sent but network unresponsive. Will retry automatically.",
        data: responseData,
      };
    }

    // ON HOLD: 600-699 - ORDER_ONHOLD
    if (statusCode >= 600 && statusCode < 700 && status === "ORDER_ONHOLD") {
      return {
        success: false,
        pending: true,
        reference: reference,
        providerReference: responseData.orderid,
        status: status,
        message:
          responseData.remark ||
          "Transaction on hold. Will retry automatically.",
        data: responseData,
      };
    }

    // ERRORS: 400-499 - ORDER_ERROR
    if (statusCode >= 400 && statusCode < 500 && status === "ORDER_ERROR") {
      logger.error(`ClubKonnect ${operationType} error`, {
        statusCode,
        remark: responseData.remark,
      });

      throw new AppError(
        responseData.remark || `${operationType} failed`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    // CANCELLED: 500-599 - ORDER_CANCELLED
    if (statusCode >= 500 && statusCode < 600 && status === "ORDER_CANCELLED") {
      logger.error(`ClubKonnect ${operationType} cancelled`, {
        statusCode,
        remark: responseData.remark,
      });

      throw new AppError(
        responseData.remark || `${operationType} was cancelled`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    // UNSPECIFIED ERRORS: x99 codes
    if (statusCode % 100 === 99) {
      logger.error(`ClubKonnect ${operationType} unspecified error`, {
        statusCode,
        status,
      });

      throw new AppError(
        "Unspecified error occurred",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    // Unknown status - treat as pending for safety
    logger.warn(`ClubKonnect ${operationType} unknown status`, {
      statusCode,
      status,
    });

    return {
      success: false,
      pending: true,
      reference: reference,
      providerReference: responseData.orderid,
      status: status,
      message: "Transaction status unclear, please requery",
      data: responseData,
    };
  }

  // Handle ClubKonnect Error - Centralized error handling
  private handleError(error: any, operationType: string): never {
    if (error instanceof AppError) {
      throw error;
    }

    if (error.response) {
      logger.error(`ClubKonnect ${operationType} error`, {
        status: error.response.status,
        data: error.response.data,
      });

      // Try to extract status message from response
      const errorMessage =
        error.response.data?.status ||
        error.response.data?.remark ||
        error.response.data?.message;

      if (errorMessage) {
        throw new AppError(
          errorMessage,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.PROVIDER_ERROR
        );
      }
    }

    logger.error(`ClubKonnect ${operationType} error`, error.message);

    throw new AppError(
      error.message || `${operationType} failed`,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.PROVIDER_ERROR
    );
  }

  // Get ClubKonnect Network Code
  private getNetworkCode(network: string): string {
    const networkMap: { [key: string]: string } = {
      mtn: "01",
      glo: "02",
      "9mobile": "03",
      etisalat: "03",
      airtel: "04",
    };

    const code = networkMap[network.toLowerCase()];

    if (!code) {
      throw new AppError(
        `Unsupported network: ${network}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return code;
  }

  // Get ClubKonnect Cable TV Code
  private getCableTvCode(provider: string): string {
    const cableTvMap: { [key: string]: string } = {
      dstv: "dstv",
      gotv: "gotv",
      startimes: "startimes",
      startime: "startimes",
    };

    const code = cableTvMap[provider.toLowerCase()];

    if (!code) {
      throw new AppError(
        `Unsupported cable TV provider: ${provider}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return code;
  }

  // Get ClubKonnect Electric Company Code
  private getElectricCompanyCode(provider: string): string {
    const electricCompanyMap: { [key: string]: string } = {
      ekedc: "01",
      "eko-electric": "01",
      ikedc: "02",
      "ikeja-electric": "02",
      aedc: "03",
      "abuja-electric": "03",
      kedc: "04",
      "kano-electric": "04",
      phedc: "05",
      "portharcourt-electric": "05",
      "port-harcourt-electric": "05",
      jedc: "06",
      "jos-electric": "06",
      ibedc: "07",
      "ibadan-electric": "07",
      kaedc: "08",
      "kaduna-electric": "08",
      eedc: "09",
      "enugu-electric": "09",
      bedc: "10",
      "benin-electric": "10",
      yedc: "11",
      "yola-electric": "11",
      aple: "12",
      "aba-electric": "12",
    };

    const code = electricCompanyMap[provider.toLowerCase()];

    if (!code) {
      throw new AppError(
        `Unsupported electric company: ${provider}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return code;
  }

  // Get ClubKonnect Meter Type Code
  private getMeterTypeCode(meterType: string): string {
    const meterTypeMap: { [key: string]: string } = {
      prepaid: "01",
      postpaid: "02",
    };

    const code = meterTypeMap[meterType.toLowerCase()];

    if (!code) {
      throw new AppError(
        `Unsupported meter type: ${meterType}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return code;
  }

  // Get ClubKonnect Betting Company Code
  private getBettingCompanyCode(provider: string): string {
    const bettingCompanyMap: { [key: string]: string } = {
      msport: "msport",
      naijabet: "naijabet",
      nairabet: "nairabet",
      "bet9ja-agent": "bet9ja-agent",
      betland: "betland",
      betlion: "betlion",
      supabet: "supabet",
      bet9ja: "bet9ja",
      bangbet: "bangbet",
      betking: "betking",
      "1xbet": "1xbet",
      betway: "betway",
      merrybet: "merrybet",
      mlotto: "mlotto",
      "western-lotto": "western-lotto",
      hallabet: "hallabet",
      "green-lotto": "green-lotto",
    };

    const code = bettingCompanyMap[provider.toLowerCase()];

    if (!code) {
      throw new AppError(
        `Unsupported betting company: ${provider}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return code;
  }
}
