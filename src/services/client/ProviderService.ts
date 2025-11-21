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
import { VtuNgService } from "./providers/VtuNgService";
import { BilalsadasubService } from "./providers/BilalsadasubService";
import { ReloadlyService } from "./providers/ReloadlyService";
import { GiftBillsService } from "./providers/GiftBillsService";
import { IProvider } from "@/models/reference/Provider";
import { AmadeusService } from "./providers/AmadeusService";
import {
  AirtimeData,
  AirtimeEPINData,
  BettingData,
  CableTvData,
  DataDataDTO,
  DataEPINData,
  EducationData,
  EducationEPINData,
  ElectricityData,
  FlightBookingData,
  HotelBookingData,
  InternationalAirtimeData,
  InternationalDataData,
  ProviderResponse,
  UtilityPaymentData,
} from "@/types";

export class ProviderService {
  private vtpassService: VTPassService;
  private clubKonnectService: ClubKonnectService;
  private coolsubService: CoolsubService;
  private mySimHostingService: MySimHostingService;
  private mydataplugClient: AxiosInstance;
  private vtuNgService: VtuNgService;
  private bilalsadasubService: BilalsadasubService;
  private reloadlyService: ReloadlyService;
  private giftBillsService: GiftBillsService;
  private amadeusService: AmadeusService;

  constructor() {
    // Initialize VTPass Service
    this.vtpassService = new VTPassService();

    // Initialize ClubKonnect Service
    this.clubKonnectService = new ClubKonnectService();

    // Initialize Coolsub Service
    this.coolsubService = new CoolsubService();

    // Initialize MySimHosting Service
    this.mySimHostingService = new MySimHostingService();

    // Initialize VTU.ng Service
    this.vtuNgService = new VtuNgService();

    // Initialize Bilalsadasub Service
    this.bilalsadasubService = new BilalsadasubService();

    // Initialize Reloadly Service
    this.reloadlyService = new ReloadlyService();

    // Initialize Amadeus Service
    this.amadeusService = new AmadeusService();

    // Initialize Gift Bills Service
    this.giftBillsService = new GiftBillsService();

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

      const providerMapping = await ServiceTypeProvider.findOne({
        serviceTypeId: serviceType._id,
        isActive: true,
        deletedAt: null,
      })
        .sort({ priority: 1 })
        .populate({
          path: "providerId",
          match: { isActive: true, deletedAt: null },
          select: "+apiKey +apiSecret",
        });

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
   * Get all active services for a specific service type code
   */
  async getServicesByServiceTypeCode(serviceTypeCode: string): Promise<any[]> {
    try {
      const serviceType = await ServiceType.findOne({
        code: serviceTypeCode,
        isActive: true,
        deletedAt: null,
      });

      if (!serviceType) {
        return [];
      }

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
   * Get all products for a specific service type
   */
  async getProductsByServiceTypeCode(serviceTypeCode: string): Promise<any[]> {
    try {
      const serviceType = await ServiceType.findOne({
        code: serviceTypeCode,
        isActive: true,
        deletedAt: null,
      });

      if (!serviceType) {
        return [];
      }

      const services = await Service.find({
        serviceTypeId: serviceType._id,
        isActive: true,
        deletedAt: null,
      }).select("_id");

      const serviceIds = services.map((s) => s._id);

      const products = await Product.find({
        serviceId: { $in: serviceIds },
        isActive: true,
      })
        .populate({
          path: "providerId",
          match: { isActive: true, deletedAt: null },
        })
        .populate({
          path: "serviceId",
          select: "name code logo serviceTypeId",
        })
        .sort({ amount: 1 })
        .lean();

      return products
        .filter((p) => p.providerId !== null)
        .map((product) => {
          const provider = product.providerId as IProvider;
          return {
            id: product._id,
            name: product.name,
            code: product.code,
            dataType: product.attributes?.dataType,
            amount: product.amount,
            providerAmount: product.providerAmount,
            validity: product.validity,
            description: product.description,
            service: product.serviceId,
            provider: {
              id: provider.id,
              name: provider.name,
              code: provider.code,
            },
          };
        });
    } catch (error: any) {
      logger.error(`Error fetching products for ${serviceTypeCode}`, error);
      throw new AppError(
        "Failed to fetch products",
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.PROVIDER_ERROR
      );
    }
  }

  // Get products for a specific service
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
        query["attributes.dataType"] = dataType;
      }

      const products = await Product.find(query).sort({ amount: 1 }).lean();

      return products.map((product) => ({
        id: product._id,
        name: product.name,
        code: product.code,
        dataType: product.attributes?.dataType,
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
      const dataTypes = await Product.distinct("attributes.dataType", {
        isActive: true,
        dataType: { $exists: true, $ne: null },
      });

      return dataTypes;
    } catch (error: any) {
      logger.error("Error fetching data types", error);
      return ["SME", "GIFTING", "DIRECT", "CORPORATE GIFTING", "PACKAGE"];
    }
  }

  // ============= DOMESTIC SERVICES =============

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
        case "vtung":
          return await this.vtuNgService.purchaseAirtime(data);
        case "mydataplug":
          return await this.mydataplugPurchaseAirtime(data);
        case "bilalsadasub":
          return await this.bilalsadasubService.purchaseAirtime(data);
        case "giftbills":
          return await this.giftBillsService.purchaseAirtime(data);
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
        case "vtung":
          return await this.vtuNgService.purchaseData(data);
        case "bilalsadasub":
          return await this.bilalsadasubService.purchaseData(data);
        case "giftbills":
          return await this.giftBillsService.purchaseData(data);
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
        case "vtung":
          return await this.vtuNgService.purchaseCableTv(data);
        case "bilalsadasub":
          return await this.bilalsadasubService.purchaseCableTv(data);
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
        case "vtung":
          return await this.vtuNgService.purchaseElectricity(data);
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
        case "vtung":
          return await this.vtuNgService.fundBetting(data);
        case "giftbills":
          return await this.giftBillsService.fundBetting(data);
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

  // ============= E-PIN SERVICES =============

  async purchaseAirtimeEPIN(data: AirtimeEPINData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("airtime_epin");
      logger.info(
        `Processing airtime E-PIN purchase with ${provider.code}`,
        data
      );

      switch (provider.code.toLowerCase()) {
        case "clubkonnect":
          return await this.clubKonnectService.purchaseAirtimeEPIN(data);
        case "vtung":
          return await this.vtuNgService.purchaseEPINs(data);
        default:
          throw new AppError(
            `Unsupported airtime E-PIN provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Airtime E-PIN purchase failed", error);
      throw error;
    }
  }

  async purchaseDataEPIN(data: DataEPINData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("data_epin");
      logger.info(`Processing data E-PIN purchase with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "clubkonnect":
          return await this.clubKonnectService.purchaseDataEPIN(data);
        default:
          throw new AppError(
            `Unsupported data E-PIN provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Data E-PIN purchase failed", error);
      throw error;
    }
  }

  async purchaseWAECEPIN(data: EducationEPINData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("waec");
      logger.info(`Processing WAEC e-PIN purchase with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "clubkonnect":
          return await this.clubKonnectService.purchaseWAECEPIN(data);
        default:
          throw new AppError(
            `Unsupported WAEC provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("WAEC e-PIN purchase failed", error);
      throw error;
    }
  }

  async purchaseJAMBEPIN(data: EducationEPINData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("jamb");
      logger.info(`Processing JAMB e-PIN purchase with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.purchaseEducation({
            profileId: data.profileId || "",
            phone: data.phone,
            variationCode: data.examType,
            amount: 0,
            reference: data.reference,
          });
        case "clubkonnect":
          return await this.clubKonnectService.purchaseJAMBEPIN(data);
        default:
          throw new AppError(
            `Unsupported JAMB provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("JAMB e-PIN purchase failed", error);
      throw error;
    }
  }

  // ============= FLIGHT ==============
  /**
   * Search for cities/airports for flight booking
   */
  async searchFlightCities(keyword: string): Promise<any> {
    try {
      const provider = await this.getActiveApiProvider("flight");
      logger.info(`Searching cities with ${provider.code}`, { keyword });

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.searchCities(keyword);
        default:
          throw new AppError(
            `Unsupported flight provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("City search failed", error);
      throw error;
    }
  }

  /**
   * Search for available flights
   */
  async searchFlights(params: {
    originLocationCode: string;
    destinationLocationCode: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    children?: number;
    infants?: number;
    travelClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
    nonStop?: boolean;
    max?: number;
  }): Promise<any> {
    try {
      const provider = await this.getActiveApiProvider("flight");
      logger.info(`Searching flights with ${provider.code}`, params);

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.searchFlights(params);
        default:
          throw new AppError(
            `Unsupported flight provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Flight search failed", error);
      throw error;
    }
  }

  /**
   * Validate flight offer price before booking
   */
  async validateFlightPrice(flightOffer: any): Promise<any> {
    try {
      const provider = await this.getActiveApiProvider("flight");
      logger.info(`Validating flight price with ${provider.code}`);

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.validateFlightPrice(flightOffer);
        default:
          throw new AppError(
            `Unsupported flight provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Flight price validation failed", error);
      throw error;
    }
  }

  /**
   * Book a flight
   */
  async bookFlight(data: FlightBookingData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("flight");
      logger.info(`Booking flight with ${provider.code}`, {
        reference: data.reference,
      });

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.bookFlight({
            flightOffer: data.flightOffer,
            travelers: data.travelers,
            reference: data.reference,
          });
        default:
          throw new AppError(
            `Unsupported flight provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Flight booking failed", error);
      throw error;
    }
  }

  /**
   * Get flight order details
   */
  async getFlightOrder(orderId: string): Promise<any> {
    try {
      const provider = await this.getActiveApiProvider("flight");
      logger.info(`Getting flight order with ${provider.code}`, { orderId });

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.getFlightOrder(orderId);
        default:
          throw new AppError(
            `Unsupported flight provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Get flight order failed", error);
      throw error;
    }
  }

  /**
   * Cancel a flight order
   */
  async cancelFlightOrder(orderId: string): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("flight");
      logger.info(`Cancelling flight order with ${provider.code}`, { orderId });

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.cancelFlightOrder(orderId);
        default:
          throw new AppError(
            `Unsupported flight provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Cancel flight order failed", error);
      throw error;
    }
  }

  /**
   * Get all airlines
   */
  async getAirlines(): Promise<any> {
    try {
      const provider = await this.getActiveApiProvider("flight");
      logger.info(`Getting airlines with ${provider.code}`);

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.getAirlines();
        default:
          throw new AppError(
            `Unsupported flight provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Get airlines failed", error);
      throw error;
    }
  }

  // ============= INTERNATIONAL AIRTIME DISPATCH =============

  /**
   * Purchase international airtime with provider dispatch
   * Supports multiple providers: VTPass, Reloadly
   */
  async purchaseInternationalAirtime(
    data: InternationalAirtimeData
  ): Promise<ProviderResponse> {
    try {
      // If provider is specified, use it directly
      if (data.provider) {
        logger.info(
          `Processing international airtime with specified provider: ${data.provider}`,
          data
        );

        switch (data.provider.toLowerCase()) {
          case "vtpass":
            return await this.vtpassService.purchaseInternationalAirtime({
              phone: data.phone,
              amount: data.amount,
              countryCode: data.countryCode,
              operatorId: data.operatorId,
              variationCode: data.variationCode || "",
              reference: data.reference,
              email: data.email || "",
            });
          case "reloadly":
            return await this.reloadlyService.purchaseInternationalAirtime({
              phone: data.phone,
              amount: data.amount,
              countryCode: data.countryCode,
              operatorId: data.operatorId,
              reference: data.reference,
            });
          default:
            throw new AppError(
              `Unsupported international airtime provider: ${data.provider}`,
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.PROVIDER_ERROR
            );
        }
      }

      // Otherwise, use database configured provider
      const provider = await this.getActiveApiProvider("internationalAirtime");
      logger.info(
        `Processing international airtime with ${provider.code}`,
        data
      );

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.purchaseInternationalAirtime({
            phone: data.phone,
            amount: data.amount,
            countryCode: data.countryCode,
            operatorId: data.operatorId,
            variationCode: data.variationCode || "",
            reference: data.reference,
            email: data.email || "",
          });
        case "reloadly":
          return await this.reloadlyService.purchaseInternationalAirtime({
            phone: data.phone,
            amount: data.amount,
            countryCode: data.countryCode,
            operatorId: data.operatorId,
            reference: data.reference,
          });
        default:
          throw new AppError(
            `Unsupported international airtime provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("International airtime purchase failed", error);
      throw error;
    }
  }

  // ============= INTERNATIONAL DATA DISPATCH =============

  /**
   * Purchase international data with provider dispatch
   * Supports multiple providers: VTPass, Reloadly
   * NOTE: Reloadly uses the same airtime API for data bundles
   */
  async purchaseInternationalData(
    data: InternationalDataData
  ): Promise<ProviderResponse> {
    try {
      // If provider is specified, use it directly
      if (data.provider) {
        logger.info(
          `Processing international data with specified provider: ${data.provider}`,
          data
        );

        switch (data.provider.toLowerCase()) {
          case "vtpass":
            return await this.vtpassService.purchaseInternationalData({
              phone: data.phone,
              amount: data.amount,
              countryCode: data.countryCode,
              operatorId: data.operatorId,
              variationCode: data.variationCode,
              reference: data.reference,
              email: data.email || "",
            });
          case "reloadly":
            // Reloadly uses the same airtime endpoint for data bundles
            return await this.reloadlyService.purchaseInternationalData({
              phone: data.phone,
              amount: data.amount,
              countryCode: data.countryCode,
              operatorId: data.operatorId,
              reference: data.reference,
            });
          default:
            throw new AppError(
              `Unsupported international data provider: ${data.provider}`,
              HTTP_STATUS.BAD_REQUEST,
              ERROR_CODES.PROVIDER_ERROR
            );
        }
      }

      // Otherwise, use database configured provider
      const provider = await this.getActiveApiProvider("internationalData");
      logger.info(`Processing international data with ${provider.code}`, data);

      switch (provider.code.toLowerCase()) {
        case "vtpass":
          return await this.vtpassService.purchaseInternationalData({
            phone: data.phone,
            amount: data.amount,
            countryCode: data.countryCode,
            operatorId: data.operatorId,
            variationCode: data.variationCode,
            reference: data.reference,
            email: data.email || "",
          });
        case "reloadly":
          // Reloadly uses the same airtime endpoint for data bundles
          return await this.reloadlyService.purchaseInternationalData({
            phone: data.phone,
            amount: data.amount,
            countryCode: data.countryCode,
            operatorId: data.operatorId,
            reference: data.reference,
          });
        default:
          throw new AppError(
            `Unsupported international data provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("International data purchase failed", error);
      throw error;
    }
  }

  // ============= INTERNATIONAL AIRTIME QUERY METHODS =============

  async getInternationalAirtimeCountries(
    provider?: "vtpass" | "reloadly"
  ): Promise<any> {
    if (provider === "reloadly") {
      return await this.reloadlyService.getInternationalAirtimeCountries();
    }
    // Default to VTPass
    return await this.vtpassService.getInternationalAirtimeCountries();
  }

  async getInternationalAirtimeProductTypes(countryCode: string): Promise<any> {
    return await this.vtpassService.getInternationalAirtimeProductTypes(
      countryCode
    );
  }

  async getInternationalAirtimeProviders(
    countryCode?: string,
    provider?: "vtpass" | "reloadly"
  ): Promise<any> {
    if (provider === "reloadly" && countryCode) {
      return await this.reloadlyService.getOperatorsByCountry(countryCode);
    }
    // Default to VTPass
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

  // ============= INTERNATIONAL DATA QUERY METHODS =============

  async getInternationalDataCountries(
    provider?: "vtpass" | "reloadly"
  ): Promise<any> {
    if (provider === "reloadly") {
      return await this.reloadlyService.getInternationalAirtimeCountries();
    }
    // Default to VTPass
    return await this.vtpassService.getInternationalDataCountries();
  }

  async getInternationalDataProviders(
    countryCode?: string,
    provider?: "vtpass" | "reloadly"
  ): Promise<any> {
    if (provider === "reloadly" && countryCode) {
      // Get operators with data support only
      return await this.reloadlyService.getDataBundleOperators(countryCode);
    }
    // Default to VTPass
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

  // ============= RELOADLY SPECIFIC METHODS =============

  async detectReloadlyOperator(
    phone: string,
    countryCode: string
  ): Promise<any> {
    return await this.reloadlyService.detectOperator(phone, countryCode);
  }

  async getReloadlyOperatorById(operatorId: string): Promise<any> {
    return await this.reloadlyService.getOperatorById(operatorId);
  }

  // ============= GIFT CARD METHODS =============

  async getGiftCardProducts(filters?: {
    countryCode?: string;
    productName?: string;
    categoryId?: number;
    page?: number;
    size?: number;
  }): Promise<any> {
    const provider = await this.getActiveApiProvider("giftcard");
    logger.info(`Fetching gift card products with ${provider.code}`, filters);

    switch (provider.code.toLowerCase()) {
      case "reloadly":
        return await this.reloadlyService.getGiftCardProducts(filters);
      default:
        throw new AppError(
          `Unsupported gift card provider: ${provider.code}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.PROVIDER_ERROR
        );
    }
  }

  async getGiftCardProductById(productId: number): Promise<any> {
    const provider = await this.getActiveApiProvider("giftcard");

    switch (provider.code.toLowerCase()) {
      case "reloadly":
        return await this.reloadlyService.getGiftCardProductById(productId);
      default:
        throw new AppError(
          `Unsupported gift card provider: ${provider.code}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.PROVIDER_ERROR
        );
    }
  }

  async getGiftCardCountries(): Promise<any> {
    const provider = await this.getActiveApiProvider("giftcard");

    switch (provider.code.toLowerCase()) {
      case "reloadly":
        return await this.reloadlyService.getGiftCardCountries();
      default:
        throw new AppError(
          `Unsupported gift card provider: ${provider.code}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.PROVIDER_ERROR
        );
    }
  }

  async getGiftCardCategories(): Promise<any> {
    const provider = await this.getActiveApiProvider("giftcard");

    switch (provider.code.toLowerCase()) {
      case "reloadly":
        return await this.reloadlyService.getGiftCardCategories();
      default:
        throw new AppError(
          `Unsupported gift card provider: ${provider.code}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.PROVIDER_ERROR
        );
    }
  }

  async orderGiftCard(data: {
    productId: number;
    quantity: number;
    unitPrice: number;
    customIdentifier: string;
    senderName: string;
    recipientEmail?: string;
    recipientPhoneDetails?: {
      countryCode: string;
      phoneNumber: string;
    };
    userId?: string;
  }): Promise<ProviderResponse> {
    const provider = await this.getActiveApiProvider("giftcard");
    logger.info(`Processing gift card order with ${provider.code}`, data);

    switch (provider.code.toLowerCase()) {
      case "reloadly":
        return await this.reloadlyService.orderGiftCard(data);
      default:
        throw new AppError(
          `Unsupported gift card provider: ${provider.code}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.PROVIDER_ERROR
        );
    }
  }

  async getGiftCardRedeemCode(transactionId: string): Promise<any> {
    const provider = await this.getActiveApiProvider("giftcard");

    switch (provider.code.toLowerCase()) {
      case "reloadly":
        return await this.reloadlyService.getGiftCardRedeemCode(transactionId);
      default:
        throw new AppError(
          `Unsupported gift card provider: ${provider.code}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.PROVIDER_ERROR
        );
    }
  }

  // ============= UTILITY PAYMENT METHODS =============

  /**
   * Get all utility billers
   * Currently only supported by Reloadly
   */
  async getUtilityBillers(filters?: {
    type?: string;
    serviceType?: string;
    countryCode?: string;
    page?: number;
    size?: number;
  }): Promise<any> {
    try {
      // For now, utility payments are Reloadly-exclusive
      // If you add more providers later, add dispatch logic here
      logger.info("Fetching utility billers from Reloadly", filters);
      return await this.reloadlyService.getUtilityBillers(filters);
    } catch (error: any) {
      logger.error("Failed to get utility billers", error);
      throw error;
    }
  }

  /**
   * Get biller by ID
   */
  async getBillerById(billerId: number): Promise<any> {
    try {
      logger.info(`Fetching biller details for ID: ${billerId}`);
      return await this.reloadlyService.getBillerById(billerId);
    } catch (error: any) {
      logger.error("Failed to get biller details", error);
      throw error;
    }
  }

  /**
   * Pay utility bill
   * Currently only supported by Reloadly
   */
  async payUtilityBill(data: UtilityPaymentData): Promise<ProviderResponse> {
    try {
      logger.info("Processing utility payment with Reloadly", data);
      return await this.reloadlyService.payUtilityBill(data);
    } catch (error: any) {
      logger.error("Utility payment failed", error);
      throw error;
    }
  }

  /**
   * Get utility transaction status
   */
  async getUtilityTransaction(transactionId: string): Promise<any> {
    try {
      logger.info(`Fetching utility transaction: ${transactionId}`);
      return await this.reloadlyService.getUtilityTransaction(transactionId);
    } catch (error: any) {
      logger.error("Failed to get utility transaction", error);
      throw error;
    }
  }

  // ============= VERIFICATION METHODS =============

  async verifySmartCard(
    smartCardNumber: string,
    provider: string
  ): Promise<any> {
    return await this.vtpassService.verifySmartCard(smartCardNumber, provider);
  }

  async verifyMeterNumber(
    meterNumber: string,
    provider: string,
    meterType: string
  ): Promise<any> {
    return await this.vtpassService.verifyMeterNumber(
      meterNumber,
      provider,
      meterType
    );
  }

  async verifyJambProfile(profileId: string, type: string): Promise<any> {
    return await this.vtpassService.verifyJambProfile(profileId, type);
  }

  // ============= CLUBKONNECT SPECIFIC METHODS =============

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

  // ============= COOLSUB SPECIFIC METHODS =============

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

  // ============= MYSIMHOSTING SPECIFIC METHODS =============

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

  // ============= VTUNG SPECIFIC METHODS =============

  async queryVtuNgTransaction(requestId: string): Promise<any> {
    return await this.vtuNgService.requeryTransaction(requestId);
  }

  async checkVtuNgBalance(): Promise<any> {
    return await this.vtuNgService.checkBalance();
  }

  async verifyVtuNgSmartCard(
    smartCardNumber: string,
    provider: string
  ): Promise<any> {
    return await this.vtuNgService.verifySmartCard(smartCardNumber, provider);
  }

  async verifyVtuNgMeterNumber(
    meterNumber: string,
    provider: string,
    meterType: string
  ): Promise<any> {
    return await this.vtuNgService.verifyMeterNumber(
      meterNumber,
      provider,
      meterType
    );
  }

  async verifyVtuNgBettingCustomer(
    customerId: string,
    provider: string
  ): Promise<any> {
    return await this.vtuNgService.verifyBettingCustomer(customerId, provider);
  }

  // ============= BILALSADASUB SPECIFIC METHODS =============

  async verifyBilalsadasubMeterNumber(
    meterNumber: string,
    provider: string,
    meterType: string
  ): Promise<any> {
    return await this.bilalsadasubService.verifyMeterNumber(
      meterNumber,
      provider,
      meterType
    );
  }

  // ============= MYDATAPLUG METHODS (LEGACY) =============

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

  // ============= HOTEL BOOKING METHODS =============

  /**
   * Search for available hotels
   */
  async searchHotels(params: {
    cityCode?: string;
    latitude?: number;
    longitude?: number;
    radius?: number;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    roomQuantity?: number;
    currency?: string;
  }): Promise<any> {
    try {
      const provider = await this.getActiveApiProvider("hotel");
      logger.info(`Searching hotels with ${provider.code}`, params);

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.searchHotels(params);
        default:
          throw new AppError(
            `Unsupported hotel provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Hotel search failed", error);
      throw error;
    }
  }

  /**
   * Book a hotel
   */
  async bookHotel(data: HotelBookingData): Promise<ProviderResponse> {
    try {
      const provider = await this.getActiveApiProvider("hotel");
      logger.info(`Booking hotel with ${provider.code}`, {
        reference: data.reference,
      });

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.bookHotel({
            offerId: data.offerId,
            guests: data.guests,
            payments: data.payments,
            reference: data.reference,
          });
        default:
          throw new AppError(
            `Unsupported hotel provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Hotel booking failed", error);
      throw error;
    }
  }

  /**
   * Get hotels by city code
   */
  async getHotelsByCity(cityCode: string): Promise<any> {
    try {
      const provider = await this.getActiveApiProvider("hotel");
      logger.info(`Getting hotels by city with ${provider.code}`, { cityCode });

      switch (provider.code.toLowerCase()) {
        case "amadeus":
          return await this.amadeusService.getHotelsByCity(cityCode);
        default:
          throw new AppError(
            `Unsupported hotel provider: ${provider.code}`,
            HTTP_STATUS.BAD_REQUEST,
            ERROR_CODES.PROVIDER_ERROR
          );
      }
    } catch (error: any) {
      logger.error("Get hotels by city failed", error);
      throw error;
    }
  }
}
