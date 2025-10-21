import { BaseRepository } from './BaseRepository';
import { Service, IService } from '@/models/reference/Service';

export class ServiceRepository extends BaseRepository<IService> {
  constructor() {
    super(Service);
  }

  async findActive(): Promise<IService[]> {
    return this.model.find({ active: true, deletedAt: null }).exec();
  }

  async findByCode(code: string): Promise<IService | null> {
    return this.model.findOne({ code, deletedAt: null }).exec();
  }

  async findByProductType(productType: string): Promise<IService[]> {
    return this.model.find({ productType, active: true, deletedAt: null }).exec();
  }
}
