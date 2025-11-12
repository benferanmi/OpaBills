import { Router } from 'express';
import { UserManagementController } from '@/controllers/admin/UserManagementController';
import { adminAuth } from '@/middlewares/admin/adminAuth';
import { requirePermission } from '@/middlewares/admin/adminPermission';
import { auditLog } from '@/middlewares/admin/auditLogger';
import { ADMIN_PERMISSIONS } from '@/utils/admin-permissions';

const router = Router();
const userController = new UserManagementController();

// All routes require admin authentication
router.use(adminAuth);

router.get(
  '/',
  requirePermission(ADMIN_PERMISSIONS.USERS.VIEW),
  userController.listUsers
);

router.get(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.USERS.VIEW),
  userController.getUserDetails
);

router.put(
  '/:id',
  requirePermission(ADMIN_PERMISSIONS.USERS.UPDATE),
  auditLog('update_user_status', 'user'),
  userController.updateUserStatus
);

router.put(
  '/:id/mark-as-fraudulent',
  requirePermission(ADMIN_PERMISSIONS.USERS.SUSPEND),
  auditLog('mark_as_fraudulent', 'user'),
  userController.markAsFraudulent
);

router.post(
  '/:id/wallet',
  requirePermission(ADMIN_PERMISSIONS.USERS.MANAGE_WALLET),
  auditLog('manage_wallet', 'user'),
  userController.manageWallet
);

export default router;
