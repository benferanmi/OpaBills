import axios, { AxiosInstance } from "axios";
import { Service } from "@/models/reference/Service";
import { Provider } from "@/models/reference/Provider";
import { Product } from "@/models/reference/Product";
import logger from "@/logger";

/**
 * Service to sync services and products from third-party APIs
 * This should be run initially and periodically to keep data updated
 */
export class ThirdPartyProviderSyncService {
  private vtpassClient: AxiosInstance;

  constructor() {
    this.vtpassClient = axios.create({
      baseURL:
        process.env.VTPASS_BASE_URL || "https://api-service.vtpass.com/api",
      headers: {
        "Content-Type": "application/json",
      },
      auth: {
        username: process.env.VTPASS_API_KEY || "",
        password: process.env.VTPASS_SECRET_KEY || "",
      },
    });
  }

  /**
   * Sync all services and products from VTPass
   */
  async syncAllFromVTPass(): Promise<void> {
    try {
      logger.info("Starting VTPass sync...");

      await this.syncAirtimeServices();
      await this.syncDataServices();
      await this.syncCableTvProviders();
      await this.syncElectricityProviders();
      await this.syncBettingProviders();

      logger.info("VTPass sync completed successfully");
    } catch (error: any) {
      logger.error("VTPass sync failed", error);
      throw error;
    }
  }

  /**
   * Sync Airtime Services (MTN, GLO, AIRTEL, 9MOBILE)
   */
  private async syncAirtimeServices(): Promise<void> {
    try {
      const airtimeServices = [
        { code: "mtn", name: "MTN", logo: "/assets/logos/mtn.png" },
        { code: "glo", name: "GLO", logo: "/assets/logos/glo.png" },
        { code: "airtel", name: "AIRTEL", logo: "/assets/logos/airtel.png" },
        {
          code: "etisalat",
          name: "9MOBILE",
          logo: "/assets/logos/9mobile.png",
        },
      ];

      for (const service of airtimeServices) {
        await Service.findOneAndUpdate(
          { code: service.code, productType: "airtime" },
          {
            name: service.name,
            code: service.code,
            logo: service.logo,
            productType: "airtime",
            active: true,
          },
          { upsert: true, new: true }
        );
      }

      logger.info("Airtime services synced");
    } catch (error: any) {
      logger.error("Error syncing airtime services", error);
      throw error;
    }
  }

  /**
   * Sync Data Services and Products from VTPass
   */
  private async syncDataServices(): Promise<void> {
    try {
      // Fetch data variations from VTPass
      const networks = ["mtn-data", "glo-data", "airtel-data", "etisalat-data"];

      for (const networkCode of networks) {
        const response = await this.vtpassClient.get(
          `/service-variations?serviceID=${networkCode}`
        );

        if (
          response.data.response_description === "000" ||
          response.data.content
        ) {
          const variations = response.data.content.varations || [];

          // Get or create service
          const serviceName = networkCode.replace("-data", "").toUpperCase();
          const service = await Service.findOneAndUpdate(
            { code: networkCode, productType: "data" },
            {
              name: serviceName,
              code: networkCode,
              productType: "data",
              active: true,
            },
            { upsert: true, new: true }
          );

          // Create products for each variation
          for (const variation of variations) {
            await Product.findOneAndUpdate(
              {
                serviceId: service._id,
                code: variation.variation_code,
                productType: "data",
              },
              {
                name: variation.name,
                code: variation.variation_code,
                serviceCode: networkCode,
                type: "data",
                productType: "data",
                amount: parseFloat(variation.variation_amount),
                serviceId: service._id,
                active: true,
                description: variation.name,
                validity: this.extractValidity(variation.name),
                dataType: this.extractDataType(variation.name),
              },
              { upsert: true, new: true }
            );
          }
        }
      }

      logger.info("Data services and products synced");
    } catch (error: any) {
      logger.error("Error syncing data services", error);
      throw error;
    }
  }

  /**
   * Sync Cable TV Providers and Packages
   */
  private async syncCableTvProviders(): Promise<void> {
    try {
      const cableProviders = ["dstv", "gotv", "startimes", "showmax"];

      for (const providerCode of cableProviders) {
        const response = await this.vtpassClient.get(
          `/service-variations?serviceID=${providerCode}`
        );

        if (
          response.data.response_description === "000" ||
          response.data.content
        ) {
          const variations = response.data.content.varations || [];

          // Create or update provider
          const provider = await Provider.findOneAndUpdate(
            { shortName: providerCode, productType: "cable_tv" },
            {
              name: providerCode.toUpperCase(),
              shortName: providerCode,
              productType: "cable_tv",
              active: true,
            },
            { upsert: true, new: true }
          );

          // Create products (packages) for each variation
          for (const variation of variations) {
            await Product.findOneAndUpdate(
              {
                providerId: provider._id,
                code: variation.variation_code,
                productType: "cable_tv",
              },
              {
                name: variation.name,
                code: variation.variation_code,
                serviceCode: providerCode,
                type: "cable_tv",
                productType: "cable_tv",
                amount: parseFloat(variation.variation_amount),
                providerId: provider._id,
                active: true,
                description: variation.name,
              },
              { upsert: true, new: true }
            );
          }
        }
      }

      logger.info("Cable TV providers and packages synced");
    } catch (error: any) {
      logger.error("Error syncing cable TV providers", error);
      throw error;
    }
  }

  /**
   * Sync Electricity Providers
   */
  private async syncElectricityProviders(): Promise<void> {
    try {
      const electricityProviders = [
        { code: "ikeja-electric", name: "Ikeja Electric" },
        { code: "eko-electric", name: "Eko Electric" },
        { code: "kano-electric", name: "Kano Electric" },
        { code: "portharcourt-electric", name: "Port Harcourt Electric" },
        { code: "jos-electric", name: "Jos Electric" },
        { code: "ibadan-electric", name: "Ibadan Electric" },
        { code: "kaduna-electric", name: "Kaduna Electric" },
        { code: "abuja-electric", name: "Abuja Electric" },
      ];

      for (const providerData of electricityProviders) {
        const provider = await Provider.findOneAndUpdate(
          { shortName: providerData.code, productType: "electricity" },
          {
            name: providerData.name,
            shortName: providerData.code,
            productType: "electricity",
            active: true,
          },
          { upsert: true, new: true }
        );

        // Fetch variations (meter types)
        const response = await this.vtpassClient.get(
          `/service-variations?serviceID=${providerData.code}`
        );

        if (
          response.data.response_description === "000" ||
          response.data.content
        ) {
          const variations = response.data.content.varations || [];

          for (const variation of variations) {
            await Product.findOneAndUpdate(
              {
                providerId: provider._id,
                code: variation.variation_code,
                productType: "electricity",
              },
              {
                name: variation.name,
                code: variation.variation_code,
                serviceCode: providerData.code,
                type: "electricity",
                productType: "electricity",
                amount: parseFloat(variation.variation_amount || 0),
                providerId: provider._id,
                active: true,
                description: variation.name,
              },
              { upsert: true, new: true }
            );
          }
        }
      }

      logger.info("Electricity providers synced");
    } catch (error: any) {
      logger.error("Error syncing electricity providers", error);
      throw error;
    }
  }

  /**
   * Sync Betting Providers
   */
  private async syncBettingProviders(): Promise<void> {
    try {
      const bettingProviders = [
        { code: "bet9ja", name: "Bet9ja" },
        { code: "betking", name: "BetKing" },
        { code: "betway", name: "Betway" },
        { code: "1xbet", name: "1xBet" },
        { code: "sportybet", name: "SportyBet" },
        { code: "nairabet", name: "NairaBet" },
      ];

      for (const providerData of bettingProviders) {
        await Provider.findOneAndUpdate(
          { shortName: providerData.code, productType: "betting" },
          {
            name: providerData.name,
            shortName: providerData.code,
            productType: "betting",
            active: true,
          },
          { upsert: true, new: true }
        );
      }

      logger.info("Betting providers synced");
    } catch (error: any) {
      logger.error("Error syncing betting providers", error);
      throw error;
    }
  }

  /**
   * Helper: Extract data type from product name
   */
  private extractDataType(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("sme")) return "SME";
    if (nameLower.includes("gifting")) return "GIFTING";
    if (nameLower.includes("corporate")) return "CORPORATE GIFTING";
    if (nameLower.includes("direct")) return "DIRECT";
    return "SME"; // default
  }

  /**
   * Helper: Extract validity period from product name
   */
  private extractValidity(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.includes("daily") || nameLower.includes("1 day"))
      return "1 day";
    if (nameLower.includes("weekly") || nameLower.includes("7 days"))
      return "7 days";
    if (nameLower.includes("2 weeks") || nameLower.includes("14 days"))
      return "14 days";
    if (nameLower.includes("monthly") || nameLower.includes("30 days"))
      return "30 days";
    if (nameLower.includes("2 months") || nameLower.includes("60 days"))
      return "60 days";
    if (nameLower.includes("3 months") || nameLower.includes("90 days"))
      return "90 days";
    if (nameLower.includes("6 months") || nameLower.includes("180 days"))
      return "180 days";
    if (nameLower.includes("yearly") || nameLower.includes("365 days"))
      return "365 days";
    return "30 days"; // default
  }

  /**
   * Get service variations from VTPass (for testing/debugging)
   */
  async getVTPassVariations(serviceID: string): Promise<any> {
    try {
      const response = await this.vtpassClient.get(
        `/service-variations?serviceID=${serviceID}`
      );
      return response.data;
    } catch (error: any) {
      logger.error(`Error fetching variations for ${serviceID}`, error);
      throw error;
    }
  }
}
