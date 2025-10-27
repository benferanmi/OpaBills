import { Router } from 'express';
import { GiftCardController } from '@/controllers/client/GiftCardController';

import { authenticate } from '@/middlewares/auth';
import { serviceCheck } from '@/middlewares/serviceCheck';
import { walletLock } from '@/middlewares/walletLock';
import { rateLimiter } from '@/middlewares/rateLimiter';
import { validateRequest, validateQuery } from '@/middlewares/validation';


const router = Router();

const giftCardController = new GiftCardController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck('giftcard'));

// Get gift cards by type (sell or buy)
router.get('/:type?', giftCardController.getGiftCards);

// Transaction breakdown
router.post('/breakdown', giftCardController.getBreakdown);

// Create transaction (buy/sell)
// router.post('/', rateLimiter(10, 60000), walletLock, giftCardController.createGiftCardTransaction);

// Get current rates (public endpoint - no auth)
// router.get('/rates', giftCardController.getGiftCardRates);

export default router;
