import { Router } from 'express';
import { FAQRepository, FaqCategoryRepository } from '@/repositories/FAQRepository';
import { sendSuccessResponse } from '@/utils/helpers';

const router = Router();

// Initialize repositories
const faqRepository = new FAQRepository();
const faqCategoryRepository = new FaqCategoryRepository();

// Public routes (no authentication required)

// Get all FAQs
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const result = await faqRepository.findWithPagination({ status: 'active' }, page, limit);
    return sendSuccessResponse(res, result, 'FAQs retrieved successfully');
  } catch (error) {
    next(error);
  }
});

// Get FAQ categories
router.get('/categories', async (req, res, next) => {
  try {
    const categories = await faqCategoryRepository.find({ status: 'active' });
    return sendSuccessResponse(res, categories, 'FAQ categories retrieved successfully');
  } catch (error) {
    next(error);
  }
});

// Get FAQs by category
router.get('/categories/:slug', async (req, res, next) => {
  try {
    const category = await faqCategoryRepository.findOne({ slug: req.params.slug });
    if (!category) {
      return sendSuccessResponse(res, [], 'Category not found');
    }
    const faqs = await faqRepository.find({ faqCategoryId: category._id });
    return sendSuccessResponse(res, faqs, 'FAQs retrieved successfully');
  } catch (error) {
    next(error);
  }
});

// Search FAQs
router.get('/search', async (req, res, next) => {
  try {
    const query = req.query.q as string;
    const filter = {
      $or: [
        { question: { $regex: query, $options: 'i' } },
        { answer: { $regex: query, $options: 'i' } },
      ],
    };
    const faqs = await faqRepository.find(filter);
    return sendSuccessResponse(res, faqs, 'Search results');
  } catch (error) {
    next(error);
  }
});

// Get single FAQ by slug
router.get('/:slug', async (req, res, next) => {
  try {
    const faq = await faqRepository.findOne({ slug: req.params.slug });
    return sendSuccessResponse(res, faq, 'FAQ retrieved successfully');
  } catch (error) {
    next(error);
  }
});

export default router;
