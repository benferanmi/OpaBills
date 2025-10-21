import { BaseRepository } from './BaseRepository';
import { Product, IProduct } from '@/models/reference/Product';
import { Types } from 'mongoose';

export class ProductRepository extends BaseRepository<IProduct> {
  constructor() {
    super(Product);
  }

  async findActive(): Promise<IProduct[]> {
    return this.model.find({ active: true }).populate('providerId serviceId').exec();
  }

  async findByProviderId(providerId: string | Types.ObjectId): Promise<IProduct[]> {
    return this.model.find({ providerId, active: true }).populate('serviceId').exec();
  }

  async findByServiceId(serviceId: string | Types.ObjectId): Promise<IProduct[]> {
    return this.model.find({ serviceId, active: true }).populate('providerId').exec();
  }

  async findByProductType(productType: string): Promise<IProduct[]> {
    return this.model.find({ productType, active: true }).populate('providerId serviceId').exec();
  }

  async searchByName(name: string): Promise<IProduct[]> {
    return this.model.find({ name: new RegExp(name, 'i'), active: true }).populate('providerId serviceId').exec();
  }
}
