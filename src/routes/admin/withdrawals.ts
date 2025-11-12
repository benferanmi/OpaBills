import { Router } from 'express';
import { WithdrawalManagementController } from '@/controllers/admin/WithdrawalManagementController';
import { adminAuth } from '@/middlewares/admin/adminAuth';
import { requirePermission } from '@/middlewares/admin/adminPermission';
import { auditLog } from '@/middlewares/admin/auditLogger';
import { ADMIN_PERMISSIONS } from '@/utils/admin-permissions';

const router = Router();
const withdrawalController = new WithdrawalManagementController();

// All routes require admin authentication
router.use(adminAuth);

router.get(
  '/',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.VIEW_WITHDRAWALS),
  withdrawalController.listWithdrawals
);

router.get(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.VIEW_WITHDRAWALS),
  withdrawalController.getWithdrawalDetails
);

router.put(
  '/:id/action/approve',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.APPROVE_WITHDRAWALS),
  auditLog('approve_withdrawal', 'withdrawal'),
  withdrawalController.approveWithdrawal
);

router.put(
  '/:id/action/decline',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.APPROVE_WITHDRAWALS),
  auditLog('decline_withdrawal', 'withdrawal'),
  withdrawalController.declineWithdrawal
);

router.post(
  '/:id/transfer/:provider',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.APPROVE_WITHDRAWALS),
  auditLog('process_withdrawal', 'withdrawal'),
  withdrawalController.processWithdrawal
);

export default router;
