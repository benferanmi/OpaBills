import { Router } from "express";
import { ServiceChargeController } from "@/controllers/admin/ServiceChargeController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import {
  createServiceChargeValidationSchema,
  updateServiceChargeValidationSchema,
} from "@/validations/admin/serviceChargeValidation";
import { validateRequest } from "@/middlewares/validation";

const router = Router();
const serviceChargeController = new ServiceChargeController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SERVICE_CHARGES.VIEW),
  serviceChargeController.listServiceCharges
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SERVICE_CHARGES.CREATE),
  validateRequest(createServiceChargeValidationSchema),
  serviceChargeController.createServiceCharge
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SERVICE_CHARGES.VIEW),
  serviceChargeController.getServiceChargeDetails
);

router.put(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SERVICE_CHARGES.UPDATE),
  validateRequest(updateServiceChargeValidationSchema),
  serviceChargeController.updateServiceCharge
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SERVICE_CHARGES.DELETE),
  serviceChargeController.deleteServiceCharge
);

export default router;
