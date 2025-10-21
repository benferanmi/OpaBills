import { Router } from 'express';
import { WalletController } from '@/controllers/client/WalletController';

import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import { walletTypeSchema, creditWalletSchema, debitWalletSchema } from '@/validations/client/walletValidation';

const router = Router();


const walletController = new WalletController();

// Routes (all protected)
router.use(authenticate);
router.get('/', validateQuery(walletTypeSchema), walletController.getWallet);
router.get('/all', walletController.getAllWallets);
router.post('/credit', validateRequest(creditWalletSchema), walletController.creditWallet);
router.post('/debit', validateRequest(debitWalletSchema), walletController.debitWallet);

export default router;
