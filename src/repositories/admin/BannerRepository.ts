import { BaseRepository } from '../BaseRepository';
import { Banner, IBanner } from '@/models/system/Banner';

export class BannerRepository extends BaseRepository<IBanner> {
  constructor() {
    super(Banner);
  }

  async findActiveBanners(): Promise<IBanner[]> {
    return await this.model.find({ activatedAt: { $lte: new Date() } }).sort({ createdAt: -1 }).exec();
  }
}
