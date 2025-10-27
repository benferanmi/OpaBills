import { CountryRepository } from "@/repositories/CountryRepository";
import { StateRepository } from "@/repositories/StateRepository";
import { CityRepository } from "@/repositories/CityRepository";
import { ProviderRepository } from "@/repositories/ProviderRepository";
import { ServiceRepository } from "@/repositories/ServiceRepository";
import { ProductRepository } from "@/repositories/ProductRepository";
import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Bank } from "@/models/reference/Bank";
import { FlutterwaveService } from "./FlutterwaveService";
export class ReferenceDataService {
  private countryRepository: CountryRepository;
  private stateRepository: StateRepository;
  private cityRepository: CityRepository;
  private providerRepository: ProviderRepository;
  private serviceRepository: ServiceRepository;
  private productRepository: ProductRepository;
  private bankAccountRepository: BankAccountRepository;
  private flutterwaveService: FlutterwaveService;

  constructor() {
    this.countryRepository = new CountryRepository();
    this.stateRepository = new StateRepository();
    this.cityRepository = new CityRepository();
    this.providerRepository = new ProviderRepository();
    this.serviceRepository = new ServiceRepository();
    this.productRepository = new ProductRepository();
    this.bankAccountRepository = new BankAccountRepository();
    this.flutterwaveService = new FlutterwaveService();
  }

  // Countries
  async getAllCountries(page: number = 1, limit: number = 50): Promise<any> {
    const { data, total } = await this.countryRepository.findWithPagination(
      {},
      page,
      limit,
      { name: 1 }
    );
    return { countries: data, total, page, limit };
  }

  async getCountryById(id: string): Promise<any> {
    const country = await this.countryRepository.findById(id);
    if (!country) {
      throw new AppError(
        "Country not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return country;
  }

  async searchCountries(
    query: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const filter = {
      $or: [
        { name: { $regex: query, $options: "i" } },
        { iso2: { $regex: query, $options: "i" } },
        { iso3: { $regex: query, $options: "i" } },
      ],
    };
    const { data, total } = await this.countryRepository.findWithPagination(
      filter,
      page,
      limit,
      { name: 1 }
    );
    return { countries: data, total, page, limit };
  }

  // States
  async getStatesByCountry(
    countryId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const { data, total } = await this.stateRepository.findWithPagination(
      { countryId },
      page,
      limit,
      { name: 1 }
    );
    return { states: data, total, page, limit };
  }

  async getStateById(id: string): Promise<any> {
    const state = await this.stateRepository.findById(id);
    if (!state) {
      throw new AppError(
        "State not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return state;
  }

  async searchStates(
    countryId: string,
    query: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const filter = {
      countryId,
      name: { $regex: query, $options: "i" },
    };
    const { data, total } = await this.stateRepository.findWithPagination(
      filter,
      page,
      limit,
      { name: 1 }
    );
    return { states: data, total, page, limit };
  }

  // Cities
  async getCitiesByState(
    stateId: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const { data, total } = await this.cityRepository.findWithPagination(
      { stateId },
      page,
      limit,
      { name: 1 }
    );
    return { cities: data, total, page, limit };
  }

  async getCityById(id: string): Promise<any> {
    const city = await this.cityRepository.findById(id);
    if (!city) {
      throw new AppError(
        "City not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return city;
  }

  async searchCities(
    stateId: string,
    query: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const filter = {
      stateId,
      name: { $regex: query, $options: "i" },
    };
    const { data, total } = await this.cityRepository.findWithPagination(
      filter,
      page,
      limit,
      { name: 1 }
    );
    return { cities: data, total, page, limit };
  }

  // Providers
  async getProviders(
    productType?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const filter: any = { active: true };
    if (productType) {
      filter.productType = productType;
    }
    const { data, total } = await this.providerRepository.findWithPagination(
      filter,
      page,
      limit,
      { name: 1 }
    );
    return { providers: data, total, page, limit };
  }

  async getProviderById(id: string): Promise<any> {
    const provider = await this.providerRepository.findById(id);
    if (!provider) {
      throw new AppError(
        "Provider not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return provider;
  }

  // Services
  async getServices(
    productType?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const filter: any = { active: true };
    if (productType) {
      filter.productType = productType;
    }
    const { data, total } = await this.serviceRepository.findWithPagination(
      filter,
      page,
      limit,
      { name: 1 }
    );
    return { services: data, total, page, limit };
  }

  async getServiceById(id: string): Promise<any> {
    const service = await this.serviceRepository.findById(id);
    if (!service) {
      throw new AppError(
        "Service not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return service;
  }

  // Products
  async getProducts(filters: {
    providerId?: string;
    serviceId?: string;
    productType?: string;
    dataType?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    const {
      providerId,
      serviceId,
      productType,
      dataType,
      page = 1,
      limit = 50,
    } = filters;

    const filter: any = { active: true };
    if (providerId) filter.providerId = providerId;
    if (serviceId) filter.serviceId = serviceId;
    if (productType) filter.productType = productType;
    if (dataType) filter.dataType = dataType;

    const { data, total } = await this.productRepository.findWithPagination(
      filter,
      page,
      limit,
      { amount: 1 }
    );
    return { products: data, total, page, limit };
  }

  async getProductById(id: string): Promise<any> {
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new AppError(
        "Product not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return product;
  }

  async searchProducts(
    query: string,
    productType?: string,
    page: number = 1,
    limit: number = 50
  ): Promise<any> {
    const filter: any = {
      active: true,
      name: { $regex: query, $options: "i" },
    };
    if (productType) {
      filter.productType = productType;
    }
    const { data, total } = await this.productRepository.findWithPagination(
      filter,
      page,
      limit,
      { name: 1 }
    );
    return { products: data, total, page, limit };
  }

  // Banks
  async getBanks(page: number = 1, limit: number = 100): Promise<any> {
    const data = await this.flutterwaveService.getBanks();
    return { banks: data, total: data.length, page, limit };
  }
}
