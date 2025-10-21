import { Router } from 'express';
import { WalletController } from '@/controllers/WalletController';
import { WalletService } from '@/services/WalletService';
import { WalletRepository } from '@/repositories/WalletRepository';
import { LedgerRepository } from '@/repositories/LedgerRepository';
import { NotificationRepository } from '@/repositories/NotificationRepository';
import { CacheService } from '@/services/CacheService';
import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import { walletTypeSchema, creditWalletSchema, debitWalletSchema } from '@/validations/walletValidation';

const router = Router();

// Initialize dependencies
const walletRepository = new WalletRepository();
const ledgerRepository = new LedgerRepository();
const notificationRepository = new NotificationRepository();
const cacheService = new CacheService();
const walletService = new WalletService(walletRepository, ledgerRepository, cacheService, notificationRepository);
const walletController = new WalletController(walletService);

// Routes (all protected)
router.use(authenticate);
router.get('/', validateQuery(walletTypeSchema), walletController.getWallet);
router.get('/all', walletController.getAllWallets);
router.post('/credit', validateRequest(creditWalletSchema), walletController.creditWallet);
router.post('/debit', validateRequest(debitWalletSchema), walletController.debitWallet);

export default router;
