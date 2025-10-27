import { Router } from 'express';
import { BillPaymentController } from '@/controllers/client/BillPaymentController';

import { authenticate } from '@/middlewares/auth';
import { walletLock } from '@/middlewares/walletLock';
import { serviceCheck } from '@/middlewares/serviceCheck';
import { rateLimiter } from '@/middlewares/rateLimiter';
import { validateRequest } from '@/middlewares/validation';
import { dataPurchaseSchema } from '@/validations/client/billpaymentValidation';

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck('data'));

// Get data services by type (SME, GIFTING, DIRECT)
router.get('/:type?', billPaymentController.getDataServices);
router.get('/:type/:service', billPaymentController.getDataProducts);
router.post('/:type/verify', billPaymentController.verifyPhone);
router.post('/:type', rateLimiter(10, 60000), walletLock, validateRequest(dataPurchaseSchema), billPaymentController.purchaseData);
router.get('/history', billPaymentController.getDataHistory);
router.post('/bulk', rateLimiter(3, 60000), walletLock, billPaymentController.bulkPurchaseData);

export default router;
