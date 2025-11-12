import { Router } from "express";
import { AlertController } from "@/controllers/admin/AlertController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { auditLog } from "@/middlewares/admin/auditLogger";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";
import {
  createAlertValidation,
  updateAlertValidation,
} from "@/validations/admin/alertValidation";

const router = Router();
const alertController = new AlertController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_ALERTS),
  alertController.listAlerts
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_ALERTS),
  validateRequest(createAlertValidation),
  auditLog("create", "alert"),
  alertController.createAlert
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_ALERTS),
  alertController.getAlertDetails
);

router.post(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_ALERTS),
  validateRequest(updateAlertValidation),
  auditLog("update", "alert"),
  alertController.updateAlert
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_ALERTS),
  auditLog("delete", "alert"),
  alertController.deleteAlert
);

router.patch(
  "/:id/restore",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_ALERTS),
  auditLog("restore", "alert"),
  alertController.restoreAlert
);

router.post(
  "/:id/dispatch",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.SEND_ALERTS),
  auditLog("dispatch", "alert"),
  alertController.dispatchAlert
);

export default router;
