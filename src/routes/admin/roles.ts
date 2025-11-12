import { Router } from "express";
import { RoleController } from "@/controllers/admin/RoleController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { auditLog } from "@/middlewares/admin/auditLogger";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";

import {
  createRoleValidation,
  udpateRoleValidation,
} from "@/validations/admin/roleValidation";

const router = Router();
const roleController = new RoleController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.MANAGE_ROLES),
  roleController.listRoles
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.MANAGE_ROLES),
  validateRequest(createRoleValidation),
  auditLog("create", "role"),
  roleController.createRole
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.MANAGE_ROLES),
  roleController.getRoleDetails
);

router.post(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.MANAGE_ROLES),
  validateRequest(udpateRoleValidation),
  auditLog("update", "role"),
  roleController.updateRole
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.MANAGE_ROLES),
  auditLog("delete", "role"),
  roleController.deleteRole
);

router.get(
  "/permissions/all",
  requirePermission(ADMIN_PERMISSIONS.ADMIN.MANAGE_ROLES),
  roleController.getAllPermissions
);

export default router;
