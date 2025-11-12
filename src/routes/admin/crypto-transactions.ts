import { Router } from 'express';
import { CryptoTransactionViewController } from '@/controllers/admin/CryptoTransactionViewController';
import { adminAuth } from '@/middlewares/admin/adminAuth';
import { requirePermission } from '@/middlewares/admin/adminPermission';
import { ADMIN_PERMISSIONS } from '@/utils/admin-permissions';

const router = Router();
const cryptoTransactionViewController = new CryptoTransactionViewController();

router.use(adminAuth);

router.get(
  '/',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  cryptoTransactionViewController.listCryptoTransactions
);

router.get(
  '/stats',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  cryptoTransactionViewController.getCryptoTransactionStats
);

router.get(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  cryptoTransactionViewController.getCryptoTransactionDetails
);

export default router;
