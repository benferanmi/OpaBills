import { BaseRepository } from './BaseRepository';
import { Provider, IProvider } from '@/models/reference/Provider';

export class ProviderRepository extends BaseRepository<IProvider> {
  constructor() {
    super(Provider);
  }

  async findActive(): Promise<IProvider[]> {
    return this.model.find({ active: true, deletedAt: null }).exec();
  }

  async findByShortName(shortName: string): Promise<IProvider | null> {
    return this.model.findOne({ shortName, deletedAt: null }).exec();
  }

  async findByProductType(productType: string): Promise<IProvider[]> {
    return this.model.find({ productType, active: true, deletedAt: null }).exec();
  }
}
