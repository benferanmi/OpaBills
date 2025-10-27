import { Router } from 'express';
import { GiftCardController } from '@/controllers/client/GiftCardController';

import { authenticate } from '@/middlewares/auth';
import { validateQuery } from '@/middlewares/validation';
import {
  giftCardTransactionQuerySchema,
} from '@/validations/client/giftcardValidation';

const router = Router();


const giftCardController = new GiftCardController();

// All routes require authentication
router.use(authenticate);

router.get('/', validateQuery(giftCardTransactionQuerySchema), giftCardController.getGiftCardTransactions);
// router.get('/pending', giftCardController.getPendingGiftCardTransactions);
// router.get('/completed', giftCardController.getCompletedGiftCardTransactions);
// router.get('/stats', giftCardController.getGiftCardTransactionStats);
router.get('/:id', giftCardController.getGiftCardTransactionById);
// router.put('/:id/upload-proof', giftCardController.uploadTransactionProof);
// router.post('/:id/transfer', giftCardController.transferToWallet);

export default router;
