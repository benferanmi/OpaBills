import { Router } from 'express';
import { BillPaymentController } from '@/controllers/client/BillPaymentController';
import { BillPaymentService } from '@/services/client/BillPaymentService';
import { TransactionRepository } from '@/repositories/TransactionRepository';
import { NotificationRepository } from '@/repositories/NotificationRepository';
import { WalletService } from '@/services/client/WalletService';
import { WalletRepository } from '@/repositories/WalletRepository';
import { LedgerRepository } from '@/repositories/LedgerRepository';
import { ProductRepository } from '@/repositories/ProductRepository';
import { ProviderService } from '@/services/client/ProviderService';
import { CacheService } from '@/services/CacheService';
import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import {
  airtimePurchaseSchema,
  dataPurchaseSchema,
  cableTvSchema,
  electricitySchema,
  transactionQuerySchema,
} from '@/validations/client/billpaymentValidation';

const router = Router();

// Initialize dependencies
const transactionRepository = new TransactionRepository();
const notificationRepository = new NotificationRepository();
const productRepository = new ProductRepository();
const providerService = new ProviderService();
const walletService = new WalletService();
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
