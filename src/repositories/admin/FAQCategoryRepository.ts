import { BaseRepository } from '../BaseRepository';
import { FaqCategory, IFaqCategory } from '@/models/system/FaqCategory';

export class FAQCategoryRepository extends BaseRepository<IFaqCategory> {
  constructor() {
    super(FaqCategory);
  }

  async findBySlug(slug: string): Promise<IFaqCategory | null> {
    return await this.model.findOne({ slug }).exec();
  }

  async findActiveCategories(): Promise<IFaqCategory[]> {
    return await this.model.find({ status: 'active' }).exec();
  }
}
