import { Router } from 'express';
import { BillPaymentController } from '@/controllers/client/BillPaymentController';

import { authenticate } from '@/middlewares/auth';
import { walletLock } from '@/middlewares/walletLock';
import { serviceCheck } from '@/middlewares/serviceCheck';
import { rateLimiter } from '@/middlewares/rateLimiter';
import { validateRequest } from '@/middlewares/validation';
import { cableTvSchema, verifySmartCardNumberSchema } from '@/validations/client/billpaymentValidation';
import { checkAndVerifyPin } from '@/middlewares/checkAndVerifyPin';

const router = Router();


const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck('tv'));

router.get('/', billPaymentController.getTvProviders);
router.get('/:providerId', billPaymentController.getTvPackages);
router.post('/verify', validateRequest(verifySmartCardNumberSchema), billPaymentController.verifySmartCardNumber);
router.post('/', rateLimiter(10, 60000), checkAndVerifyPin, walletLock, validateRequest(cableTvSchema), billPaymentController.purchaseCableTv);
// router.get('/history', billPaymentController.getTvHistory);

export default router;