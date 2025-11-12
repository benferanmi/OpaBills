import { Router } from 'express';
import { TransactionManagementController } from '@/controllers/admin/TransactionManagementController';
import { adminAuth } from '@/middlewares/admin/adminAuth';
import { requirePermission } from '@/middlewares/admin/adminPermission';
import { auditLog } from '@/middlewares/admin/auditLogger';
import { ADMIN_PERMISSIONS } from '@/utils/admin-permissions';

const router = Router();
const transactionController = new TransactionManagementController();

// All routes require admin authentication
router.use(adminAuth);

router.get(
  '/',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  transactionController.listTransactions
);

router.get(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  transactionController.getTransactionDetails
);

router.put(
  '/:id/action/:status',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.UPDATE),
  auditLog('update_transaction_status', 'transaction'),
  transactionController.updateTransactionStatus
);

router.post(
  '/:id/reverse',
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.REVERSE),
  auditLog('reverse_transaction', 'transaction'),
  transactionController.reverseTransaction
);

export default router;
