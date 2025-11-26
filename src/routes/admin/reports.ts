import { Router } from 'express';
import { ReportController } from '@/controllers/admin/ReportController';
import { adminAuth } from '@/middlewares/admin/adminAuth';
import { requirePermission } from '@/middlewares/admin/adminPermission';
import { ADMIN_PERMISSIONS } from '@/utils/admin-permissions';

const router = Router();
const reportController = new ReportController();

router.use(adminAuth);

router.get(
  '/revenue',
  requirePermission(ADMIN_PERMISSIONS.REPORTS.VIEW),
  reportController.getRevenueReport
);

router.get(
  '/user-growth',
  requirePermission(ADMIN_PERMISSIONS.REPORTS.VIEW),
  reportController.getUserGrowthReport
);

router.get(
  '/transaction-summary',
  requirePermission(ADMIN_PERMISSIONS.REPORTS.VIEW),
  reportController.getTransactionSummary
);


router.get(
  '/crypto-giftcard',
  requirePermission(ADMIN_PERMISSIONS.REPORTS.VIEW),
  reportController.getCryptoGiftCardReport
);

router.get(
  '/top-users',
  requirePermission(ADMIN_PERMISSIONS.REPORTS.VIEW),
  reportController.getTopUsers
);

export default router;
