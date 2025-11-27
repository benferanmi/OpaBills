import { Router } from "express";
import { ADMIN_PERMISSIONS } from "@/types/admin";
import {
  createAdminSchema,
  getAdminsQuerySchema,
  updateAdminSchema,
} from "@/validations/admin/authValidation";
import { authorize, requireRole, verifyAdminToken } from "@/middlewares/admin/auth";
import { validateRequest } from "@/middlewares/validation";
import { AdminManagementController } from "@/controllers/admin/AdminManagementController";


const router = Router();
const adminManagementController = new AdminManagementController();

router.use(verifyAdminToken);

router.post(
  "/",
  authorize([ADMIN_PERMISSIONS.ADMIN.CREATE]) as any,
  validateRequest(createAdminSchema),
  adminManagementController.createAdmin as any
);

router.get(
  "/",
  authorize([ADMIN_PERMISSIONS.ADMIN.VIEW]) as any,
  validateRequest(getAdminsQuerySchema),
  adminManagementController.getAllAdmins
);

router.get(
  "/statistics",
  authorize([ADMIN_PERMISSIONS.ADMIN.ADMIN_STATS]) as any,
  adminManagementController.getAdminStatistics
);

router.get(
  "/:adminId",
  authorize([ADMIN_PERMISSIONS.ADMIN.VIEW]) as any,
  adminManagementController.getAdminById
);

router.put(
  "/:adminId",
  authorize([ADMIN_PERMISSIONS.ADMIN.UPDATE]) as any,
  validateRequest(updateAdminSchema),
  adminManagementController.updateAdmin as any
);

router.delete(
  "/:adminId/deactivate",
  requireRole(["super_admin"]) as any,
  authorize([ADMIN_PERMISSIONS.ADMIN.DELETE]) as any,
  adminManagementController.deactivateAdmin as any
);

router.patch(
  "/:adminId/reset-password",
  requireRole(["super_admin"]) as any,
  authorize([ADMIN_PERMISSIONS.ADMIN.UPDATE]) as any,
  adminManagementController.resetAdminPassword as any
);

export default router;
