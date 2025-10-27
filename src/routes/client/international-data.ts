import { Router } from 'express';
import { BillPaymentController } from '@/controllers/client/BillPaymentController';
import { authenticate } from '@/middlewares/auth';
import { serviceCheck } from '@/middlewares/serviceCheck';

const router = Router();


const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck('international-data'));

// router.get('/countries', billPaymentController.getInternationalDataCountries);
// router.get('/providers/:countryCode?', billPaymentController.getInternationalDataProviders);
// router.get('/products/:operator', billPaymentController.getInternationalDataProducts);
// router.post('/', rateLimiter(10, 60000), walletLock, billPaymentController.purchaseInternationalData);
// router.get('/history', billPaymentController.getInternationalDataHistory);

export default router;
