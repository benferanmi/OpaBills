import { Router } from 'express';
import { BillPaymentController } from '@/controllers/client/BillPaymentController';
import { authenticate } from '@/middlewares/auth';
import { walletLock } from '@/middlewares/walletLock';
import { serviceCheck } from '@/middlewares/serviceCheck';
import { rateLimiter } from '@/middlewares/rateLimiter';
import { validateRequest } from '@/middlewares/validation';
import { electricitySchema } from '@/validations/client/billpaymentValidation';

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck('electricity'));

router.get('/providers', billPaymentController.getElectricityProviders);
router.post('/verify', billPaymentController.verifyMeterNumber);
router.post('/', rateLimiter(10, 60000), walletLock, validateRequest(electricitySchema), billPaymentController.purchaseElectricity);
router.get('/history', billPaymentController.getElectricityHistory);

export default router;
