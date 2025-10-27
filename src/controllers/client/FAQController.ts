import { Request, Response, NextFunction } from 'express';
import { FAQService } from '@/services/client/FAQService';
import { sendSuccessResponse, sendPaginatedResponse } from '@/utils/helpers';

export class FAQController {
  constructor(private faqService: FAQService) {}

  getAllFAQs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.faqService.getAllFAQs(page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'FAQs retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const categories = await this.faqService.getFAQCategories();
      return sendSuccessResponse(res, categories, 'FAQ categories retrieved successfully');
    } catch (error) {
      next(error);
    }
  };

  getFAQsByCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await this.faqService.getFAQsByCategory(slug, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'Category FAQs retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  searchFAQs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!q || typeof q !== 'string') {
        return sendSuccessResponse(res, { data: [], total: 0 }, 'Search query required');
      }

      const result = await this.faqService.searchFAQs(q, page, limit);

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        'FAQs retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  };

  getFAQBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { slug } = req.params;
      const faq = await this.faqService.getFAQBySlug(slug);
      return sendSuccessResponse(res, faq, 'FAQ retrieved successfully');
    } catch (error) {
      next(error);
    }
  };
}
