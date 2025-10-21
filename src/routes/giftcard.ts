import { Router } from 'express';
import { GiftCardController } from '@/controllers/GiftCardController';
import { GiftCardService } from '@/services/GiftCardService';
import {
  GiftCardRepository,
  GiftCardCategoryRepository,
  GiftCardTransactionRepository,
} from '@/repositories/GiftCardRepository';
import { TransactionRepository } from '@/repositories/TransactionRepository';
import { BankAccountRepository } from '@/repositories/BankAccountRepository';
import { WalletService } from '@/services/WalletService';
import { WalletRepository } from '@/repositories/WalletRepository';
import { LedgerRepository } from '@/repositories/LedgerRepository';
import { ProviderService } from '@/services/ProviderService';
import { CacheService } from '@/services/CacheService';
import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import {
  buyGiftCardSchema,
  sellGiftCardSchema,
  bulkBuyGiftCardSchema,
  giftCardTransactionQuerySchema,
} from '@/validations/giftcardValidation';
import { paginationSchema } from '@/validations/transactionValidation';

const router = Router();

// Initialize dependencies
const giftCardRepository = new GiftCardRepository();
const giftCardCategoryRepository = new GiftCardCategoryRepository();
const giftCardTransactionRepository = new GiftCardTransactionRepository();
const transactionRepository = new TransactionRepository();
const bankAccountRepository = new BankAccountRepository();
const walletRepository = new WalletRepository();
const ledgerRepository = new LedgerRepository();
const cacheService = new CacheService();
const providerService = new ProviderService();
const walletService = new WalletService(walletRepository, ledgerRepository, cacheService);
const giftCardService = new GiftCardService(
  giftCardRepository,
  giftCardCategoryRepository,
  giftCardTransactionRepository,
  transactionRepository,
  bankAccountRepository,
  walletService,
  providerService
);
const giftCardController = new GiftCardController(giftCardService);

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
