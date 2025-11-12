import { Router } from "express";
import { SettingsController } from "@/controllers/admin/SettingsController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { auditLog } from "@/middlewares/admin/auditLogger";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { updateSettingsSchema } from "@/validations/admin/settingsValidation";
import { validateRequest } from "@/middlewares/validation";

const router = Router();
const settingsController = new SettingsController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.VIEW_SETTINGS),
  settingsController.getAllSettings
);

router.get(
  "/:code",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.VIEW_SETTINGS),
  settingsController.getSettingByCode
);

router.post(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.UPDATE_SETTINGS),
  validateRequest(updateSettingsSchema),
  auditLog("update", "setting"),
  settingsController.updateSetting
);

export default router;
