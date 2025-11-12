import { Router } from "express";
import { AdminController } from "@/controllers/admin/AdminController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { auditLog } from "@/middlewares/admin/auditLogger";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";

import {
  createAdminValidation,
  updateAdminValidation,
} from "@/validations/admin/adminManagementValidation";

const router = Router();
const adminController = new AdminController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.VIEW),
  adminController.listAdmins
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.CREATE),
  validateRequest(createAdminValidation),
  auditLog("create", "admin"),
  adminController.createAdmin
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.VIEW),
  adminController.getAdminDetails
);

router.put(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.UPDATE),
  validateRequest(updateAdminValidation),
  auditLog("update", "admin"),
  adminController.updateAdmin
);

router.put(
  "/:id/assign-role/:roleId",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.MANAGE_ROLES),
  auditLog("assign_role", "admin"),
  adminController.assignRole
);

export default router;
