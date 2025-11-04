import { BaseRepository } from "./BaseRepository";
import { Provider, IProvider } from "@/models/reference/Provider";

export class ProviderRepository extends BaseRepository<IProvider> {
  constructor() {
    super(Provider);
  }

  async findActive(): Promise<IProvider[]> {
    return this.model
      .find({ isActive: true, deletedAt: null })
      .sort({ name: 1 })
      .exec();
  }

  async findByCode(code: string): Promise<IProvider | null> {
    return this.model
      .findOne({ code: code.toLowerCase(), deletedAt: null })
      .exec();
  }

  async findByCodeWithCredentials(code: string): Promise<IProvider | null> {
    return this.model
      .findOne({ code: code.toLowerCase(), deletedAt: null })
      .select("+apiKey +apiSecret")
      .exec();
  }

  async findByIdWithCredentials(id: string): Promise<IProvider | null> {
    return this.model.findById(id).select("+apiKey +apiSecret").exec();
  }

  async codeExists(code: string, excludeId?: string): Promise<boolean> {
    const query: any = { code: code.toLowerCase(), deletedAt: null };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    const count = await this.model.countDocuments(query).exec();
    return count > 0;
  }

  async findWithFilters(
    filters: {
      isActive?: boolean;
      search?: string;
    },
    page: number = 1,
    limit: number = 10
  ): Promise<{
    data: IProvider[];
    total: number;
    page: number;
    pages: number;
  }> {
    const query: any = { deletedAt: null };

    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { code: { $regex: filters.search, $options: "i" } },
        { baseUrl: { $regex: filters.search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.model.find(query).sort({ name: 1 }).skip(skip).limit(limit).exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  async toggleActive(id: string): Promise<IProvider | null> {
    const provider = await this.findById(id);
    if (!provider) return null;

    return this.model
      .findByIdAndUpdate(id, { isActive: !provider.isActive }, { new: true })
      .exec();
  }

  async updateCredentials(
    id: string,
    credentials: {
      apiKey?: string;
      apiSecret?: string;
      publicKey?: string;
    }
  ): Promise<IProvider | null> {
    return this.model
      .findByIdAndUpdate(id, credentials, { new: true })
      .select("+apiKey +apiSecret")
      .exec();
  }

  async updateConfig(
    id: string,
    config: Record<string, any>
  ): Promise<IProvider | null> {
    return this.model.findByIdAndUpdate(id, { config }, { new: true }).exec();
  }

  async mergeConfig(
    id: string,
    configUpdate: Record<string, any>
  ): Promise<IProvider | null> {
    const provider = await this.findById(id);
    if (!provider) return null;

    const mergedConfig = {
      ...(provider.config || {}),
      ...configUpdate,
    };

    return this.model
      .findByIdAndUpdate(id, { config: mergedConfig }, { new: true })
      .exec();
  }

  async findByBaseUrl(baseUrlPattern: string): Promise<IProvider[]> {
    return this.model
      .find({
        baseUrl: { $regex: baseUrlPattern, $options: "i" },
        deletedAt: null,
      })
      .sort({ name: 1 })
      .exec();
  }

  async getStatistics(): Promise<{
    total: number;
    active: number;
    inactive: number;
    withApiKey: number;
    withPublicKey: number;
  }> {
    const [stats] = await this.model.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
          },
          withApiKey: {
            $sum: {
              $cond: [
                {
                  $and: [{ $ne: ["$apiKey", null] }, { $ne: ["$apiKey", ""] }],
                },
                1,
                0,
              ],
            },
          },
          withPublicKey: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$publicKey", null] },
                    { $ne: ["$publicKey", ""] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    return (
      stats || {
        total: 0,
        active: 0,
        inactive: 0,
        withApiKey: 0,
        withPublicKey: 0,
      }
    );
  }

  async validateProvider(id: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const provider = await this.model
      .findById(id)
      .select("+apiKey +apiSecret")
      .exec();

    if (!provider) {
      return { isValid: false, errors: ["Provider not found"] };
    }

    const errors: string[] = [];

    if (!provider.baseUrl) {
      errors.push("Base URL is required");
    }

    if (!provider.isActive) {
      errors.push("Provider is inactive");
    }

    // Add custom validation logic here based on your requirements
    try {
      new URL(provider.baseUrl);
    } catch {
      errors.push("Invalid base URL format");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async getConfigValue(id: string, key: string): Promise<any> {
    const provider = await this.findById(id);
    return provider?.config?.[key];
  }

  async setConfigValue(
    id: string,
    key: string,
    value: any
  ): Promise<IProvider | null> {
    const provider = await this.findById(id);
    if (!provider) return null;

    const config = provider.config || {};
    config[key] = value;

    return this.model.findByIdAndUpdate(id, { config }, { new: true }).exec();
  }

  async removeConfigKey(id: string, key: string): Promise<IProvider | null> {
    const provider = await this.findById(id);
    if (!provider) return null;

    const config = provider.config || {};
    delete config[key];

    return this.model.findByIdAndUpdate(id, { config }, { new: true }).exec();
  }

  async bulkUpdateStatus(
    providerIds: string[],
    isActive: boolean
  ): Promise<void> {
    await this.model
      .updateMany({ _id: { $in: providerIds } }, { isActive })
      .exec();
  }

  async findAll(): Promise<IProvider[]> {
    return this.model.find({}).sort({ name: 1 }).exec();
  }

  async restore(id: string): Promise<IProvider | null> {
    return this.model
      .findByIdAndUpdate(id, { deletedAt: null }, { new: true })
      .exec();
  }
}
