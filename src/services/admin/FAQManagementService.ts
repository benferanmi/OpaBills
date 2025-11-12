import { FAQRepository } from '@/repositories/FAQRepository';
import { FAQCategoryRepository } from '@/repositories/admin/FAQCategoryRepository';

export class FAQManagementService {
  private faqRepository: FAQRepository;
  private categoryRepository: FAQCategoryRepository;

  constructor() {
    this.faqRepository = new FAQRepository();
    this.categoryRepository = new FAQCategoryRepository();
  }

  async listFAQs(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = {};

    if (filters.categoryId) {
      query.categoryId = filters.categoryId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.search) {
      query.$or = [
        { question: { $regex: filters.search, $options: 'i' } },
        { answer: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const result = await this.faqRepository.findWithPagination(query, page, limit);

    return {
      faqs: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createFAQ(data: any) {
    const faq = await this.faqRepository.create(data);
    return { message: 'FAQ created successfully', faq };
  }

  async getFAQDetails(faqId: string) {
    const faq = await this.faqRepository.findById(faqId);
    if (!faq) {
      throw new Error('FAQ not found');
    }
    return faq;
  }

  async updateFAQ(faqId: string, data: any) {
    const faq = await this.faqRepository.findById(faqId);
    if (!faq) {
      throw new Error('FAQ not found');
    }

    Object.assign(faq, data);
    await faq.save();

    return { message: 'FAQ updated successfully', faq };
  }

  async deleteFAQ(faqId: string) {
    await this.faqRepository.delete(faqId);
    return { message: 'FAQ deleted successfully' };
  }

  async listCategories(page: number = 1, limit: number = 20) {
    const result = await this.categoryRepository.findWithPagination({}, page, limit);

    return {
      categories: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createCategory(data: any) {
    const category = await this.categoryRepository.create(data);
    return { message: 'FAQ category created successfully', category };
  }

  async updateCategory(categoryId: string, data: any) {
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new Error('FAQ category not found');
    }

    Object.assign(category, data);
    await category.save();

    return { message: 'FAQ category updated successfully', category };
  }

  async deleteCategory(categoryId: string) {
    await this.categoryRepository.delete(categoryId);
    return { message: 'FAQ category deleted successfully' };
  }
}
