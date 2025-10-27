import { Router } from 'express';
import { BillPaymentController } from '@/controllers/client/BillPaymentController';

import { authenticate } from '@/middlewares/auth';
import { walletLock } from '@/middlewares/walletLock';
import { serviceCheck } from '@/middlewares/serviceCheck';
import { rateLimiter } from '@/middlewares/rateLimiter';
import { validateRequest } from '@/middlewares/validation';
import { cableTvSchema } from '@/validations/client/billpaymentValidation';

const router = Router();


const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck('tv'));

// router.get('/', billPaymentController.getTvProviders);
// router.get('/:service', billPaymentController.getTvPackages);
// router.post('/verify', billPaymentController.verifySmartCardNumber);
router.post('/', rateLimiter(10, 60000), walletLock, validateRequest(cableTvSchema), billPaymentController.purchaseCableTv);
// router.get('/history', billPaymentController.getTvHistory);

export default router;
