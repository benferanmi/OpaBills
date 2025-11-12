import { Router } from 'express';
import { GiftCardTransactionViewController } from '@/controllers/admin/GiftCardTransactionViewController';
import { adminAuth } from '@/middlewares/admin/adminAuth';
import { requirePermission } from '@/middlewares/admin/adminPermission';
import { ADMIN_PERMISSIONS } from '@/utils/admin-permissions';

const router = Router();
const giftCardTransactionViewController = new GiftCardTransactionViewController();

router.use(adminAuth);

router.get(
  '/',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  giftCardTransactionViewController.listGiftCardTransactions
);

router.get(
  '/stats',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  giftCardTransactionViewController.getGiftCardTransactionStats
);

router.get(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  giftCardTransactionViewController.getGiftCardTransactionDetails
);

export default router;
