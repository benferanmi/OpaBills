import { Router } from 'express';
import { BillPaymentController } from '@/controllers/BillPaymentController';
import { BillPaymentService } from '@/services/BillPaymentService';
import { TransactionRepository } from '@/repositories/TransactionRepository';
import { NotificationRepository } from '@/repositories/NotificationRepository';
import { WalletService } from '@/services/WalletService';
import { WalletRepository } from '@/repositories/WalletRepository';
import { LedgerRepository } from '@/repositories/LedgerRepository';
import { ProductRepository } from '@/repositories/ProductRepository';
import { ProviderService } from '@/services/ProviderService';
import { CacheService } from '@/services/CacheService';
import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import {
  airtimePurchaseSchema,
  dataPurchaseSchema,
  cableTvSchema,
  electricitySchema,
  transactionQuerySchema,
} from '@/validations/billpaymentValidation';

const router = Router();

// Initialize dependencies
const transactionRepository = new TransactionRepository();
const notificationRepository = new NotificationRepository();
const walletRepository = new WalletRepository();
const ledgerRepository = new LedgerRepository();
const productRepository = new ProductRepository();
const cacheService = new CacheService();
const providerService = new ProviderService();
const walletService = new WalletService(walletRepository, ledgerRepository, cacheService, notificationRepository);
const billPaymentService = new BillPaymentService(
  transactionRepository,
  walletService,
  productRepository,
  providerService,
  notificationRepository
);
const billPaymentController = new BillPaymentController(billPaymentService);

// Routes (all protected)
router.use(authenticate);
router.post('/airtime', validateRequest(airtimePurchaseSchema), billPaymentController.purchaseAirtime);
router.post('/data', validateRequest(dataPurchaseSchema), billPaymentController.purchaseData);
router.post('/cable-tv', validateRequest(cableTvSchema), billPaymentController.purchaseCableTv);
router.post('/electricity', validateRequest(electricitySchema), billPaymentController.purchaseElectricity);
router.get('/transactions', validateQuery(transactionQuerySchema), billPaymentController.getBillPaymentTransactions);

export default router;
