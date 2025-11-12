import { Router } from "express";
import { ServiceTypeController } from "@/controllers/admin/ServiceTypeController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import {
  createServiceTypeSchema,
  updateServiceTypeSchema,
} from "@/validations/admin/serviceTypeValidation";
import { validateRequest } from "@/middlewares/validation";

const router = Router();
const serviceTypeController = new ServiceTypeController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SETTINGS.VIEW),
  serviceTypeController.listServiceTypes
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
  validateRequest(createServiceTypeSchema),
  serviceTypeController.createServiceType
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SETTINGS.VIEW),
  serviceTypeController.getServiceTypeDetails
);

router.put(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
  validateRequest(updateServiceTypeSchema),
  serviceTypeController.updateServiceType
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
  serviceTypeController.deleteServiceType
);

export default router;
