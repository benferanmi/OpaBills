import { Router } from 'express';
import { DepositManagementController } from '@/controllers/admin/DepositManagementController';
import { adminAuth } from '@/middlewares/admin/adminAuth';
import { requirePermission } from '@/middlewares/admin/adminPermission';
import { auditLog } from '@/middlewares/admin/auditLogger';
import { ADMIN_PERMISSIONS } from '@/utils/admin-permissions';

const router = Router();
const depositController = new DepositManagementController();

// All routes require admin authentication
router.use(adminAuth);

router.get(
  '/',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.VIEW_DEPOSITS),
  depositController.listDeposits
);

router.get(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.VIEW_DEPOSITS),
  depositController.getDepositDetails
);

router.put(
  '/:id/action/approve',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.APPROVE_DEPOSITS),
  auditLog('approve_deposit', 'deposit'),
  depositController.approveDeposit
);

router.put(
  '/:id/action/decline',
  requirePermission(ADMIN_PERMISSIONS.FINANCE.APPROVE_DEPOSITS),
  auditLog('decline_deposit', 'deposit'),
  depositController.declineDeposit
);

export default router;
