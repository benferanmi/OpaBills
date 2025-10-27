import { FAQRepository } from '@/repositories/FAQRepository';
import { FaqCategory } from '@/models/system/FaqCategory';
import { AppError } from '@/middlewares/errorHandler';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

export class FAQService {
  constructor(private faqRepository: FAQRepository) {}

  async getAllFAQs(page: number = 1, limit: number = 20) {
    return this.faqRepository.findWithPagination({ status: 'active' }, page, limit);
  }

  async getFAQCategories() {
    return FaqCategory.find({ status: 'active' }).sort({ position: 1 }).exec();
  }

  async getFAQsByCategory(categorySlug: string, page: number = 1, limit: number = 20) {
    const category = await FaqCategory.findOne({ slug: categorySlug, status: 'active' }).exec();
    
    if (!category) {
      throw new AppError('FAQ category not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    return this.faqRepository.findWithPagination(
      { categoryId: category._id, status: 'active' },
      page,
      limit
    );
  }

  async searchFAQs(query: string, page: number = 1, limit: number = 20) {
    return this.faqRepository.searchFAQs(query, page, limit);
  }

  async getFAQBySlug(slug: string) {
    const faq = await this.faqRepository.findBySlug(slug);
    
    if (!faq || faq.status !== 'active') {
      throw new AppError('FAQ not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    return faq;
  }
}
