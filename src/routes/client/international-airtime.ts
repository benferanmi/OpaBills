import { Router } from 'express';
import { BillPaymentController } from '@/controllers/client/BillPaymentController';

import { authenticate } from '@/middlewares/auth';
import { walletLock } from '@/middlewares/walletLock';
import { serviceCheck } from '@/middlewares/serviceCheck';
import { rateLimiter } from '@/middlewares/rateLimiter';

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck('international-airtime'));

// router.get('/countries', billPaymentController.getInternationalAirtimeCountries);
// router.get('/providers/:countryCode?', billPaymentController.getInternationalAirtimeProviders);
// router.post('/', rateLimiter(10, 60000), walletLock, billPaymentController.purchaseInternationalAirtime);
// router.get('/history', billPaymentController.getInternationalAirtimeHistory);

export default router;
