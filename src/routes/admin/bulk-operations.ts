import { Router } from "express";
import { BulkOperationController } from "@/controllers/admin/BulkOperationController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";

import {
  bulkDeleteUsersValidation,
  bulkImportUsersValidation,
  bulkSendNotificationValidation,
  bulkUpdateUserStatusValidation,
} from "@/validations/admin/bulkOperationValidation";

const router = Router();
const bulkOperationController = new BulkOperationController();

router.use(adminAuth);

router.post(
  "/users/update-status",
  requirePermission(ADMIN_PERMISSIONS.USERS.UPDATE),
  validateRequest(bulkUpdateUserStatusValidation),
  bulkOperationController.bulkUpdateUserStatus
);

router.post(
  "/users/delete",
  requirePermission(ADMIN_PERMISSIONS.USERS.DELETE),
  validateRequest(bulkDeleteUsersValidation),
  bulkOperationController.bulkDeleteUsers
);

router.post(
  "/users/import",
  requirePermission(ADMIN_PERMISSIONS.USERS.CREATE),
  validateRequest(bulkImportUsersValidation),
  bulkOperationController.bulkImportUsers
);

router.get(
  "/users/export",
  requirePermission(ADMIN_PERMISSIONS.USERS.VIEW),
  bulkOperationController.exportUsersToCsv
);

router.post(
  "/notifications/send",
  requirePermission(ADMIN_PERMISSIONS.NOTIFICATIONS.CREATE),
  validateRequest(bulkSendNotificationValidation),
  bulkOperationController.bulkSendNotification
);

router.post(
  "/transactions/update-status",
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.UPDATE),
  validateRequest(bulkSendNotificationValidation),
  bulkOperationController.bulkUpdateTransactionStatus
);

router.get(
  "/transactions/export",
  requirePermission(ADMIN_PERMISSIONS.TRANSACTIONS.VIEW),
  bulkOperationController.exportTransactionsToCsv
);

export default router;
