import axios, { AxiosInstance } from "axios";
import { Product } from "@/models/reference/Product";
import { Service } from "@/models/reference/Service";
import { ServiceType } from "@/models/reference/ServiceType";
import { ServiceTypeProvider } from "@/models/reference/ServiceTypeProvider";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import logger from "@/logger";
import { VTPassService } from "./providers/VtpassService";
import { ClubKonnectService } from "./providers/ClubkonnectService";
import { MySimHostingService } from "./providers/MySimHostingService";
import { CoolsubService } from "./providers/CoolsubService";

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

interface EducationData {
  profileId: string;
  phone: string;
  variationCode: string;
  amount: number;
  reference: string;
}

export class ProviderService {
  private vtpassService: VTPassService;
  private clubKonnectService: ClubKonnectService;
  private coolsubService: CoolsubService;
  private mySimHostingService: MySimHostingService;
  private mydataplugClient: AxiosInstance;

  constructor() {
    // Initialize VTPass Service
    this.vtpassService = new VTPassService();

    // Initialize ClubKonnect Service
    this.clubKonnectService = new ClubKonnectService();

    // Initialize Coolsub Service
    this.coolsubService = new CoolsubService();

    // Initialize MySimHosting Service
    this.mySimHostingService = new MySimHostingService();

    // Initialize MyDataPlug client (to be extracted later)
    this.mydataplugClient = axios.create({
      baseURL: process.env.MYDATAPLUG_BASE_URL || "https://mydataplug.com/api",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.MYDATAPLUG_API_KEY || ""}`,
      },
    });
  }

  /**
   * Get the active API provider for a specific service type code
   * Returns the Provider document with credentials
   */
  private async getActiveApiProvider(serviceTypeCode: string): Promise<any> {
    try {
      // Find the ServiceType by code
      const serviceType = await ServiceType.findOne({
        code: serviceTypeCode,
        isActive: true,
        deletedAt: null,
      });

      if (!serviceType) {
        throw new AppError(
          `Service type '${serviceTypeCode}' not found or inactive`,
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.RESOURCE_NOT_FOUND
        );
      }

      console.log(serviceType)

      // Find active provider mapping for this service type
      const providerMapping = await ServiceTypeProvider.findOne({
        serviceTypeId: serviceType._id,
        isActive: true,
        deletedAt: null,
      })
        .sort({ priority: 1 }) // Get highest priority (lowest number)
        .populate({
          path: "providerId",
          match: { isActive: true, deletedAt: null },
          select: "+apiKey +apiSecret", // Include encrypted fields
        });

      console.log(providerMapping)

      if (!providerMapping || !providerMapping.providerId) {
        throw new AppError(
          `No active provider configured for '${serviceTypeCode}'`,
          HTTP_STATUS.INTERNAL_SERVER_ERROR,
          ERROR_CODES.PROVIDER_ERROR
        );
      }

      return providerMapping.providerId;
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      logger.error(
        `Error getting active provider for ${serviceTypeCode}`,
        error
      );
      throw new AppError(
        `Failed to get provider for ${serviceTypeCode}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  /**
   * Get all active services for a specific service type code (e.g., 'airtime', 'data')
   * Returns brands like MTN, GLO, AIRTEL, 9MOBILE
   */
  async getServicesByServiceTypeCode(serviceTypeCode: string): Promise<any[]> {
    try {
      // Find the ServiceType
      const serviceType = await ServiceType.findOne({
        code: serviceTypeCode,
        isActive: true,
        deletedAt: null,
      });

      if (!serviceType) {
        return [];
      }

      // Find all services under this service type
      const services = await Service.find({
        serviceTypeId: serviceType._id,
        isActive: true,
        deletedAt: null,
      })
        .sort({ displayOrder: 1, name: 1 })
        .lean();

      return services.map((service) => ({
        id: service._id,
        name: service.name,
        code: service.code,
        logo: service.logo,
        serviceTypeCode: serviceTypeCode,
      }));
    } catch (error: any) {
      logger.error(`Error fetching services for ${serviceTypeCode}`, error);
      throw new AppError(
        "Failed to fetch services",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  /**
   * Get all products for a specific service type (all services under that type)
   */
  async getProductsByServiceTypeCode(serviceTypeCode: string): Promise<any[]> {
    try {
      // Find the ServiceType
      const serviceType = await ServiceType.findOne({
        code: serviceTypeCode,
        isActive: true,
        deletedAt: null,
      });

      if (!serviceType) {
        return [];
      }

      // Find all services under this service type
      const services = await Service.find({
        serviceTypeId: serviceType._id,
        isActive: true,
        deletedAt: null,
      }).select("_id");

      const serviceIds = services.map((s) => s._id);

      // Find all products for these services
      const products = await Product.find({
        serviceId: { $in: serviceIds },
        isActive: true,
      })
        .populate({
          path: "serviceId",
          select: "name code logo serviceTypeId",
          populate: {
            path: "serviceTypeId",
            select: "code name",
          },
        })
        .sort({ amount: 1 })
        .lean();

      return products.map((product) => ({
        id: product._id,
        name: product.name,
        code: product.code,
        dataType: product.dataType,
        amount: product.amount,
        validity: product.validity,
        description: product.description,
        service: product.serviceId,
      }));
    } catch (error: any) {
      logger.error(`Error fetching products for ${serviceTypeCode}`, error);
      throw new AppError(
        "Failed to fetch products",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  /**
   * Get products for a specific service
   */
  async getProductsByService(
    serviceId: string,
    dataType?: string
  ): Promise<any[]> {
    try {
      const query: any = {
        serviceId: serviceId,
        isActive: true,
      };

      if (dataType) {
        query.dataType = dataType;
      }

      const products = await Product.find(query).sort({ amount: 1 }).lean();

      return products.map((product) => ({
        id: product._id,
        name: product.name,
        code: product.code,
        dataType: product.dataType,
        amount: product.amount,
        validity: product.validity,
        description: product.description,
        service: product.serviceId,
      }));
    } catch (error: any) {
      logger.error("Error fetching products by service", error);
      throw new AppError(
        "Failed to fetch products",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  /**
   * Get all available data types from products
   */
  async getDataTypes(): Promise<string[]> {
    try {
      const dataTypes = await Product.distinct("dataType", {
        isActive: true,
        dataType: { $exists: true, $ne: null },
      });

      return dataTypes;
    } catch (error: any) {
      logger.error("Error fetching data types", error);
      return ["SME", "GIFTING", "DIRECT", "CORPORATE GIFTING", "PACKAGE"];
    }
  }


  async purchaseAirtime(data: AirtimeData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("airtime");
      logger.info(`Processing airtime purchase with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.purchaseAirtime(data);
        case "clubkonnect":
          return await this.clubKonnectService.purchaseAirtime(data);
        case "coolsub":
          return await this.coolsubService.purchaseAirtime(data);
        case "mysimhosting":
          return await this.mySimHostingService.purchaseAirtime(data);
        case "mydataplug":
          return await this.mydataplugPurchaseAirtime(data);
        default:
          throw new AppError(
            `Unsupported airtime provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Airtime purchase failed", error);
      throw error;
    }
  }


  async getInternationalAirtimeCountries(): Promise<any> {
    return await this.vtpassService.getInternationalAirtimeCountries();
  }

  async getInternationalAirtimeProductTypes(countryCode: string): Promise<any> {
    return await this.vtpassService.getInternationalAirtimeProductTypes(
      countryCode
    );
  }

  async getInternationalAirtimeProviders(countryCode?: string): Promise<any> {
    return await this.vtpassService.getInternationalAirtimeProviders(
      countryCode
    );
  }

  async getInternationalAirtimeVariations(
    operatorId: string,
    productTypeId: number = 1
  ): Promise<any> {
    return await this.vtpassService.getInternationalAirtimeVariations(
      operatorId,
      productTypeId
    );
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
    return await this.vtpassService.purchaseInternationalAirtime(data);
  }


  async purchaseData(data: DataDataDTO): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("data");
      logger.info(`Processing data purchase with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.purchaseData(data);
        case "clubkonnect":
          return await this.clubKonnectService.purchaseData(data);
        case "coolsub":
          return await this.coolsubService.purchaseData(data);
        case "mysimhosting":
          return await this.mySimHostingService.purchaseData(data);
        case "mydataplug":
          return await this.mydataplugPurchaseData(data);
        default:
          throw new AppError(
            `Unsupported data provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Data purchase failed", error);
      throw error;
    }
  }


  async getInternationalDataCountries(): Promise<any> {
    return await this.vtpassService.getInternationalDataCountries();
  }

  async getInternationalDataProviders(countryCode?: string): Promise<any> {
    return await this.vtpassService.getInternationalDataProviders(countryCode);
  }

  async getInternationalDataProducts(operator: string): Promise<any> {
    return await this.vtpassService.getInternationalDataProducts(operator);
  }

  async getInternationalDataProductDetails(
    variationCode: string,
    operatorId: string
  ): Promise<any> {
    return await this.vtpassService.getInternationalDataProductDetails(
      variationCode,
      operatorId
    );
  }

  async purchaseInternationalData(data: {
    phone: string;
    amount: number;
    countryCode: string;
    operatorId: string;
    variationCode: string;
    reference: string;
    email: string;
  }): Promise<ProviderResponse> {
    return await this.vtpassService.purchaseInternationalData(data);
  }


  async purchaseCableTv(data: CableTvData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("cable_tv");
      logger.info(`Processing cable TV purchase with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.purchaseCableTv(data);
        case "clubkonnect":
          return await this.clubKonnectService.purchaseCableTv(data);
        case "coolsub":
          return await this.coolsubService.purchaseCableTv(data);
        default:
          throw new AppError(
            `Unsupported cable TV provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Cable TV purchase failed", error);
      throw error;
    }
  }

  // ==================== EDUCATION/E-PIN PURCHASE ====================

  async purchaseEducation(data: EducationData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("education");
      logger.info(`Processing education purchase with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.purchaseEducation(data);
        default:
          throw new AppError(
            `Unsupported education provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Education purchase failed", error);
      throw error;
    }
  }


  async purchaseElectricity(data: ElectricityData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("electricity");
      logger.info(
        `Processing electricity purchase with ${provider.code}`,
        data
      );

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.purchaseElectricity(data);
        case "clubkonnect":
          return await this.clubKonnectService.purchaseElectricity(data);
        case "coolsub":
          return await this.coolsubService.purchaseElectricity(data);
        default:
          throw new AppError(
            `Unsupported electricity provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Electricity purchase failed", error);
      throw error;
    }
  }


  async fundBetting(data: BettingData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("betting");
      logger.info(`Processing betting funding with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.fundBetting(data);
        case "clubkonnect":
          return await this.clubKonnectService.fundBetting(data);
        case "coolsub":
          return await this.coolsubService.fundBetting(data);
        default:
          throw new AppError(
            `Unsupported betting provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Betting funding failed", error);
      throw error;
    }
  }


  async verifySmartCard(
    smartCardNumber: string,
    provider: string
  ): Promise<any> {
    // Default to VTPass for verification
    return await this.vtpassService.verifySmartCard(smartCardNumber, provider);
  }

  async verifyMeterNumber(
    meterNumber: string,
    provider: string,
    meterType: string
  ): Promise<any> {
    // Default to VTPass for verification
    return await this.vtpassService.verifyMeterNumber(
      meterNumber,
      provider,
      meterType
    );
  }

  async verifyJambProfile(profileId: string, type: string): Promise<any> {
    // VTPass only for JAMB verification
    return await this.vtpassService.verifyJambProfile(profileId, type);
  }


  async queryClubKonnectTransaction(
    orderIdOrReference: string,
    isOrderId: boolean = true
  ): Promise<any> {
    return await this.clubKonnectService.queryTransaction(
      orderIdOrReference,
      isOrderId
    );
  }

  async cancelClubKonnectTransaction(orderId: string): Promise<any> {
    return await this.clubKonnectService.cancelTransaction(orderId);
  }

  async verifyClubKonnectSmartCard(
    smartCardNumber: string,
    provider: string
  ): Promise<any> {
    return await this.clubKonnectService.verifySmartCard(
      smartCardNumber,
      provider
    );
  }

  async verifyClubKonnectMeterNumber(
    meterNumber: string,
    provider: string
  ): Promise<any> {
    return await this.clubKonnectService.verifyMeterNumber(
      meterNumber,
      provider
    );
  }

  async verifyClubKonnectBettingCustomer(
    customerId: string,
    provider: string
  ): Promise<any> {
    return await this.clubKonnectService.verifyBettingCustomer(
      customerId,
      provider
    );
  }

  async queryCoolsubAirtimeTransaction(transId: string): Promise<any> {
    return await this.coolsubService.queryAirtimeTransaction(transId);
  }

  async queryCoolsubDataTransaction(transId: string): Promise<any> {
    return await this.coolsubService.queryDataTransaction(transId);
  }

  async queryCoolsubCableTvTransaction(transId: string): Promise<any> {
    return await this.coolsubService.queryCableTvTransaction(transId);
  }

  async queryCoolsubElectricityTransaction(transId: string): Promise<any> {
    return await this.coolsubService.queryElectricityTransaction(transId);
  }

  async queryCoolsubEducationTransaction(transId: string): Promise<any> {
    return await this.coolsubService.queryEducationTransaction(transId);
  }

  async verifyCoolsubSmartCard(
    smartCardNumber: string,
    provider: string
  ): Promise<any> {
    return await this.coolsubService.verifySmartCard(smartCardNumber, provider);
  }

  async verifyCoolsubMeterNumber(
    meterNumber: string,
    provider: string,
    meterType: string
  ): Promise<any> {
    return await this.coolsubService.verifyMeterNumber(
      meterNumber,
      provider,
      meterType
    );
  }

  // ==================== MYSIMHOSTING SPECIFIC METHODS ====================

  async getMySimHostingDataPlans(): Promise<any> {
    return await this.mySimHostingService.getDataPlans();
  }

  async sendMySimHostingUSSD(data: {
    command: string;
    sim: number;
    device: string;
    to?: string;
  }): Promise<any> {
    return await this.mySimHostingService.sendUSSDRequest(data);
  }

  async sendMySimHostingSMS(data: {
    command: string;
    sim: number;
    device: string;
    to: string;
  }): Promise<any> {
    return await this.mySimHostingService.sendSMSRequest(data);
  }

  // ==================== MYDATAPLUG METHODS (Temporary - To be extracted later) ====================

  private async mydataplugPurchaseAirtime(
    data: AirtimeData
  ): Promise<ProviderResponse> {
    try {
      const response = await this.mydataplugClient.post("/topup", {
        network: this.getMyDataPlugNetworkId(data.network || ""),
        phone: data.phone,
        amount: data.amount,
      });

      const success = response.data.status === "success";

      return {
        success,
        reference: response.data.reference || `MDP_${Date.now()}`,
        providerReference: response.data.transaction_id,
        message: response.data.message || "Airtime purchase processed",
        data: response.data,
      };
    } catch (error: any) {
      logger.error(
        "MyDataPlug airtime purchase error",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.message || "Airtime purchase failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  private async mydataplugPurchaseData(
    data: DataDataDTO
  ): Promise<ProviderResponse> {
    try {
      const response = await this.mydataplugClient.post("/data", {
        network: this.getMyDataPlugNetworkId("as"),
        phone: data.phone,
        plan: data.plan,
      });

      const success = response.data.status === "success";

      return {
        success,
        reference: response.data.reference || `MDP_${Date.now()}`,
        providerReference: response.data.transaction_id,
        message: response.data.message || "Data purchase processed",
        data: response.data,
      };
    } catch (error: any) {
      logger.error(
        "MyDataPlug data purchase error",
        error.response?.data || error.message
      );
      throw new AppError(
        error.response?.data?.message || "Data purchase failed",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  private getMyDataPlugNetworkId(serviceType: string): number {
    const networkMap: { [key: string]: number } = {
      mtn: 1,
      glo: 2,
      airtel: 3,
      "9mobile": 4,
      etisalat: 4,
    };
    return networkMap[serviceType.toLowerCase()] || 1;
  }
}
