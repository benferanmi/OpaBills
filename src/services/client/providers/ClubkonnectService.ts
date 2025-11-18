import axios, { AxiosInstance } from "axios";
import { Product } from "@/models/reference/Product";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { PROVIDERS } from "@/config";
import {
  AirtimeData,
  ProviderResponse,
  DataDataDTO,
  CableTvData,
  ElectricityData,
  BettingData,
  AirtimeEPINData,
  DataEPINData,
  EducationEPINData,
} from "@/types";

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

  //  AIRTIME PURCHASE
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

  //  DATA PURCHASE
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

      // Check if it's Smile or Spectranet (use different endpoints)
      if (network.toLowerCase() === "smile") {
        return await this.purchaseSmileData({
          phone: data.phone,
          dataPlan: data.productCode,
          reference: data.reference,
        });
      }

      if (network.toLowerCase() === "spectranet") {
        return await this.purchaseSpectranetData({
          phone: data.phone,
          dataPlan: data.productCode,
          reference: data.reference,
        });
      }

      // Regular data purchase
      const networkCode = this.getNetworkCode(network);

      const response = await this.client.get("/APIDatabundleV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          MobileNetwork: networkCode,
          DataPlan: data.productCode,
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

  //  SMILE DATA PURCHASE
  async purchaseSmileData(data: {
    phone: string;
    dataPlan: string;
    reference: string;
  }): Promise<ProviderResponse> {
    try {
      const response = await this.client.get("/APISmileV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          MobileNetwork: "smile-direct",
          DataPlan: data.dataPlan,
          MobileNumber: data.phone,
          RequestID: data.reference,
        },
      });

      return this.handleResponse(
        response.data,
        data.reference,
        "Smile data purchase"
      );
    } catch (error: any) {
      return this.handleError(error, "Smile data purchase");
    }
  }

  //  SPECTRANET DATA PURCHASE
  async purchaseSpectranetData(data: {
    phone: string;
    dataPlan: string;
    reference: string;
  }): Promise<ProviderResponse> {
    try {
      const response = await this.client.get("/APISpectranetV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          MobileNetwork: "spectranet",
          DataPlan: data.dataPlan,
          MobileNumber: data.phone,
          RequestID: data.reference,
        },
      });

      return this.handleResponse(
        response.data,
        data.reference,
        "Spectranet data purchase"
      );
    } catch (error: any) {
      return this.handleError(error, "Spectranet data purchase");
    }
  }

  //  CABLE TV PURCHASE
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
      const packageCode = product.code;

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

  //  ELECTRICITY PURCHASE
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

  //  BETTING FUNDING
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

  //  AIRTIME E-PIN PURCHASE
  async purchaseAirtimeEPIN(data: AirtimeEPINData): Promise<ProviderResponse> {
    try {
      // Validate value (must be 100, 200, or 500)
      if (![100, 200, 500].includes(data.value)) {
        throw new AppError(
          "Invalid value. Must be 100, 200, or 500",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      // Validate quantity (1 to 100)
      if (data.quantity < 1 || data.quantity > 100) {
        throw new AppError(
          "Invalid quantity. Must be between 1 and 100",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const networkCode = this.getNetworkCode(data.network);

      const response = await this.client.get("/APIEPINV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          MobileNetwork: networkCode,
          Value: data.value,
          Quantity: data.quantity,
          RequestID: data.reference,
        },
      });

      // E-PIN responses are different - they return immediately with pins
      if (response.data.TXN_EPIN && Array.isArray(response.data.TXN_EPIN)) {
        return {
          success: true,
          pending: false,
          reference: data.reference,
          message: "Airtime E-PIN generated successfully",
          pins: response.data.TXN_EPIN.map((pin: any) => ({
            transactionId: pin.transactionid,
            transactionDate: pin.transactiondate,
            network: pin.mobilenetwork,
            amount: pin.amount,
            batchNo: pin.batchno,
            serialNo: pin.sno,
            pin: pin.pin,
          })),
          data: response.data,
        };
      }

      // Fallback to standard response handling if format is different
      return this.handleResponse(
        response.data,
        data.reference,
        "Airtime E-PIN purchase"
      );
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      return this.handleError(error, "Airtime E-PIN purchase");
    }
  }

  //  DATA E-PIN PURCHASE
  async purchaseDataEPIN(data: DataEPINData): Promise<ProviderResponse> {
    try {
      // Validate quantity (1 to 100)
      if (data.quantity < 1 || data.quantity > 100) {
        throw new AppError(
          "Invalid quantity. Must be between 1 and 100",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const networkCode = this.getNetworkCode(data.network);

      const response = await this.client.get("/APIDatabundleEPINV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          MobileNetwork: networkCode,
          DataPlan: data.dataPlan,
          Quantity: data.quantity,
          RequestID: data.reference,
        },
      });

      // Check for immediate E-PIN response
      if (
        response.data.TXN_EPIN_DATABUNDLE &&
        Array.isArray(response.data.TXN_EPIN_DATABUNDLE)
      ) {
        return {
          success: true,
          pending: false,
          reference: data.reference,
          message: "Data E-PIN generated successfully",
          pins: response.data.TXN_EPIN_DATABUNDLE.map((pin: any) => ({
            transactionId: pin.transactionid,
            transactionDate: pin.transactiondate,
            network: pin.mobilenetwork,
            productName: pin.productname,
            batchNo: pin.batchno,
            serialNo: pin.sno,
            pin: pin.pin,
          })),
          data: response.data,
        };
      }

      // Otherwise use standard response handling
      return this.handleResponse(
        response.data,
        data.reference,
        "Data E-PIN purchase"
      );
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      return this.handleError(error, "Data E-PIN purchase");
    }
  }

  //  WAEC E-PIN PURCHASE
  async purchaseWAECEPIN(data: EducationEPINData): Promise<ProviderResponse> {
    try {
      const response = await this.client.get("/APIWAECV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          ExamType: data.examType, // e.g., 'waecdirect'
          PhoneNo: data.phone,
          RequestID: data.reference,
        },
      });

      const result = this.handleResponse(
        response.data,
        data.reference,
        "WAEC e-PIN purchase"
      );

      // Extract PIN details from carddetails if available
      if (result.success && response.data.carddetails) {
        result.token = response.data.carddetails;
      }

      return result;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      return this.handleError(error, "WAEC e-PIN purchase");
    }
  }

  //  JAMB E-PIN PURCHASE
  async purchaseJAMBEPIN(data: EducationEPINData): Promise<ProviderResponse> {
    try {
      const response = await this.client.get("/APIJAMBV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          ExamType: data.examType, // e.g., 'jamb'
          PhoneNo: data.phone,
          RequestID: data.reference,
        },
      });

      const result = this.handleResponse(
        response.data,
        data.reference,
        "JAMB e-PIN purchase"
      );

      // Extract PIN details from carddetails if available
      if (result.success && response.data.carddetails) {
        result.token = response.data.carddetails;
      }

      return result;
    } catch (error: any) {
      if (error instanceof AppError) throw error;
      return this.handleError(error, "JAMB e-PIN purchase");
    }
  }

  //  VERIFICATION METHODS

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

  async verifySmilePhone(phone: string): Promise<any> {
    try {
      const response = await this.client.get("/APIVerifySmileV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          MobileNetwork: "smile-direct",
          MobileNumber: phone,
        },
      });

      const customerName = response.data.customer_name;

      if (
        !customerName ||
        customerName === "INVALID_ACCOUNTNO" ||
        customerName.includes("INVALID")
      ) {
        throw new AppError(
          "Invalid Smile phone number",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      return {
        valid: true,
        customerName: customerName,
        phone: phone,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        "ClubKonnect Smile phone verification error",
        error.response?.data || error.message
      );

      throw new AppError(
        error.response?.data?.customer_name ||
          "Smile phone verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  async verifyJAMBProfile(profileId: string, examType: string): Promise<any> {
    try {
      const response = await this.client.get("/APIVerifyJAMBV1.asp", {
        params: {
          UserID: this.provider.userId,
          APIKey: this.provider.apiKey,
          ExamType: examType,
          ProfileID: profileId,
        },
      });

      const customerName = response.data.customer_name;

      if (
        !customerName ||
        customerName === "INVALID_ACCOUNTNO" ||
        customerName.includes("INVALID")
      ) {
        throw new AppError(
          "Invalid JAMB profile ID",
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      return {
        valid: true,
        customerName: customerName,
        profileId: profileId,
      };
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        "ClubKonnect JAMB profile verification error",
        error.response?.data || error.message
      );

      throw new AppError(
        error.response?.data?.customer_name ||
          "JAMB profile verification failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
  }

  //  QUERY & CANCEL TRANSACTIONS

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

  //  RESPONSE HANDLERS
  private handleResponse(
    responseData: any,
    reference: string,
    operationType: string
  ): ProviderResponse {
    const statusCode = parseInt(responseData.statuscode || "0");
    const status = responseData.status || "";

    // ClubKonnect uses different field names for order ID across different services
    // orderid - for most services (airtime, data, cable, electricity)
    // transactionid - for betting and some other services
    const providerReference =
      responseData.orderid || responseData.transactionid || "";

    logger.info(`ClubKonnect ${operationType} response`, {
      statusCode,
      status,
      providerReference,
    });

    // SUCCESS: 200 - ORDER_COMPLETED
    if (statusCode === 200 && status === "ORDER_COMPLETED") {
      return {
        success: true,
        pending: false,
        reference: reference,
        providerReference: providerReference,
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
        providerReference: providerReference,
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
        providerReference: providerReference,
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
        providerReference: providerReference,
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
        providerReference: providerReference,
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

      // Map specific error codes to user-friendly messages
      const errorMessages: { [key: number]: string } = {
        400: "Invalid credentials",
        401: "Invalid request format",
        402: "User ID is missing",
        403: "API key is missing",
        404: "Mobile network is missing",
        405: "Amount is missing",
        406: "Invalid amount",
        407: "Minimum amount is 100",
        408: "Minimum amount is 50,000",
        409: "Invalid phone number",
        412: "Insufficient balance",
        417: "Insufficient balance",
        418: "Invalid mobile network",
      };

      const errorMessage =
        errorMessages[statusCode] ||
        responseData.remark ||
        `${operationType} failed`;

      throw new AppError(
        errorMessage,
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

    // UNSPECIFIED ERRORS: x99 codes (199, 299, 399, 499, 599, 699)
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

    // Handle statusCode 0 or missing - check if it's actually a valid pending status
    if (statusCode === 0 || !statusCode) {
      // Check if we have a provider reference (orderid or transactionid)
      if (providerReference) {
        // Check if status indicates a known state
        const statusUpper = status.toUpperCase();

        if (
          statusUpper === "ORDER_RECEIVED" ||
          statusUpper === "ORDER_PROCESSED"
        ) {
          // Valid pending states without proper statuscode
          logger.warn(
            `ClubKonnect ${operationType} missing statuscode but has valid status`,
            {
              status,
              providerReference,
            }
          );

          return {
            success: false,
            pending: true,
            reference: reference,
            providerReference: providerReference,
            status: status,
            message: "Transaction is being processed",
            data: responseData,
          };
        }

        if (statusUpper === "ORDER_COMPLETED") {
          // Success without proper statuscode
          logger.warn(
            `ClubKonnect ${operationType} missing statuscode but marked completed`,
            {
              status,
              providerReference,
            }
          );

          return {
            success: true,
            pending: false,
            reference: reference,
            providerReference: providerReference,
            status: status,
            message: `${operationType} successful`,
            data: responseData,
          };
        }

        // Has provider reference but unknown status
        logger.warn(
          `ClubKonnect ${operationType} unknown status with reference`,
          {
            statusCode,
            status,
            providerReference,
          }
        );

        return {
          success: false,
          pending: true,
          reference: reference,
          providerReference: providerReference,
          status: status,
          message: "Transaction status unclear, please requery",
          data: responseData,
        };
      }

      // No provider reference - likely a validation error
      logger.error(
        `ClubKonnect ${operationType} error - no provider reference`,
        {
          statusCode,
          status,
          responseData,
        }
      );

      throw new AppError(
        status || `${operationType} failed`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }

    // Unknown status code - treat as error for safety
    logger.error(`ClubKonnect ${operationType} unknown status code`, {
      statusCode,
      status,
      providerReference,
    });

    throw new AppError(
      status || "Unknown transaction status",
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.PROVIDER_ERROR
    );
  }

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

  private getNetworkCode(network: string): string {
    const networkMap: { [key: string]: string } = {
      "mtn-airtime": "01",
      "glo-airtime": "02",
      "9mobile-airtime": "03",
      "etisalat-airtime": "03",
      "airtel-airtime": "04",

      "mtn-data": "01",
      "glo-data": "02",
      "9mobile-data": "03",
      "etisalat-data": "03",
      "airtel-data": "04",
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
