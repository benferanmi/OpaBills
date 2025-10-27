import { Router } from 'express';
import { GiftCardController } from '@/controllers/client/GiftCardController';
import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import {
  buyGiftCardSchema,
  sellGiftCardSchema,
  bulkBuyGiftCardSchema,
  giftCardTransactionQuerySchema,
} from '@/validations/client/giftcardValidation';
import { paginationSchema } from '@/validations/client/transactionValidation';

const router = Router();

const giftCardController = new GiftCardController();

// Routes (all protected)
router.use(authenticate);

// Categories
router.get('/categories', validateQuery(paginationSchema), giftCardController.getCategories);
router.get('/categories/:categoryId', giftCardController.getCategoryById);

// Gift Cards
router.get('/', giftCardController.getGiftCards);
router.get('/:giftCardId', giftCardController.getGiftCardById);

// Transactions
router.post('/buy', validateRequest(buyGiftCardSchema), giftCardController.buyGiftCard);
router.post('/sell', validateRequest(sellGiftCardSchema), giftCardController.sellGiftCard);
router.post('/bulk-buy', validateRequest(bulkBuyGiftCardSchema), giftCardController.bulkBuyGiftCards);

// Transaction history
router.get(
  '/transactions/list',
  validateQuery(giftCardTransactionQuerySchema),
  giftCardController.getGiftCardTransactions
);
router.get('/transactions/:transactionId', giftCardController.getGiftCardTransactionById);
router.get('/transactions/reference/:reference', giftCardController.getGiftCardTransactionByReference);

export default router;
