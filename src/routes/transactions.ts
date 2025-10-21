import { Router } from 'express';
import { TransactionController } from '@/controllers/TransactionController';
import { TransactionService } from '@/services/TransactionService';
import { TransactionRepository } from '@/repositories/TransactionRepository';
import { WalletService } from '@/services/WalletService';
import { WalletRepository } from '@/repositories/WalletRepository';
import { LedgerRepository } from '@/repositories/LedgerRepository';
import { CacheService } from '@/services/CacheService';
import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import { createTransactionSchema, paginationSchema } from '@/validations/transactionValidation';

const router = Router();

// Initialize dependencies
const transactionRepository = new TransactionRepository();
const walletRepository = new WalletRepository();
const ledgerRepository = new LedgerRepository();
const cacheService = new CacheService();
const walletService = new WalletService(walletRepository, ledgerRepository, cacheService);
const transactionService = new TransactionService(transactionRepository, walletService);
const transactionController = new TransactionController(transactionService);

// Routes (all protected)
router.use(authenticate);
router.post('/', validateRequest(createTransactionSchema), transactionController.createTransaction);
router.get('/', validateQuery(paginationSchema), transactionController.getUserTransactions);
router.get('/:reference', transactionController.getTransaction);

export default router;
