import { Router } from "express";
import { ProviderController } from "@/controllers/admin/ProviderController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { auditLog } from "@/middlewares/admin/auditLogger";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";

import {
  createProviderValidation,
  updateProviderValidation,
} from "@/validations/admin/providerValidation";

const router = Router();
const providerController = new ProviderController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PROVIDERS),
  providerController.listProviders
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PROVIDERS),
  validateRequest(createProviderValidation),
  auditLog("create", "provider"),
  providerController.createProvider
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PROVIDERS),
  providerController.getProviderDetails
);

router.post(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PROVIDERS),
  validateRequest(updateProviderValidation),
  auditLog("update", "provider"),
  providerController.updateProvider
);

router.put(
  "/:id/:status",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PROVIDERS),
  auditLog("update_status", "provider"),
  providerController.updateProviderStatus
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PROVIDERS),
  auditLog("delete", "provider"),
  providerController.deleteProvider
);

router.get(
  "/:id/products",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PROVIDERS),
  providerController.getProviderProducts
);

export default router;
