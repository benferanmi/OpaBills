import { ProviderRepository } from "@/repositories/ProviderRepository";
import { ProductRepository } from "@/repositories/ProductRepository";

export class ProviderManagementService {
  private providerRepository: ProviderRepository;
  private productRepository: ProductRepository;

  constructor() {
    this.providerRepository = new ProviderRepository();
    this.productRepository = new ProductRepository();
  }

  async listProviders(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.search) {
      query.name = { $regex: filters.search, $options: "i" };
    }

    const result = await this.providerRepository.findWithPagination(
      query,
      page,
      limit
    );

    return {
      providers: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createProvider(data: any) {
    const provider = await this.providerRepository.create(data);
    return { message: "Provider created successfully", provider };
  }

  async getProviderDetails(providerId: string) {
    const provider = await this.providerRepository.findById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }
    return provider;
  }

  async updateProvider(providerId: string, data: any) {
    const provider = await this.providerRepository.findById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    Object.assign(provider, data);
    await provider.save();

    return { message: "Provider updated successfully", provider };
  }

  async updateProviderStatus(providerId: string, status: boolean) {
    const provider = await this.providerRepository.findById(providerId);
    if (!provider) {
      throw new Error("Provider not found");
    }

    provider.isActive = status;
    await provider.save();

    return {
      message: "Provider status updated successfully",
      status: provider.isActive,
    };
  }

  async deleteProvider(providerId: string) {
    await this.providerRepository.delete(providerId);
    return { message: "Provider deleted successfully" };
  }

  async getProviderProducts(
    providerId: string,
    page: number = 1,
    limit: number = 20
  ) {
    const result = await this.productRepository.findWithPagination(
      { providerId },
      page,
      limit
    );

    return {
      products: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }
}
