import { Router } from "express";
import { RouteActionController } from "@/controllers/admin/RouteActionController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";

import {
  createRouteAction,
  updateRouteAction,
} from "@/validations/admin/routeActionValidation";

const router = Router();
const routeActionController = new RouteActionController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.ROUTE_ACTIONS.VIEW),
  routeActionController.listRouteActions
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.ROUTE_ACTIONS.CREATE),
  validateRequest(createRouteAction),
  routeActionController.createRouteAction
);

router.get(
  "/role/:roleId",
  requirePermission(ADMIN_PERMISSIONS.ROUTE_ACTIONS.VIEW),
  routeActionController.getRoutesByRole
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.ROUTE_ACTIONS.VIEW),
  routeActionController.getRouteActionDetails
);

router.put(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.ROUTE_ACTIONS.UPDATE),
  validateRequest(updateRouteAction),
  routeActionController.updateRouteAction
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.ROUTE_ACTIONS.DELETE),
  routeActionController.deleteRouteAction
);

export default router;
