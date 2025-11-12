import { Router } from "express";
import { ProductController } from "@/controllers/admin/ProductController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { auditLog } from "@/middlewares/admin/auditLogger";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";

import {
  createProductValidation,
  updateProductValidation,
} from "@/validations/admin/productValidation";

const router = Router();
const productController = new ProductController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PRODUCTS),
  productController.listProducts
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PRODUCTS),
  validateRequest(createProductValidation),
  auditLog("create", "product"),
  productController.createProduct
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PRODUCTS),
  productController.getProductDetails
);

router.post(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PRODUCTS),
  validateRequest(updateProductValidation),
  auditLog("update", "product"),
  productController.updateProduct
);

router.put(
  "/:id/:status",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PRODUCTS),
  auditLog("update_status", "product"),
  productController.updateProductStatus
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.SYSTEM.MANAGE_PRODUCTS),
  auditLog("delete", "product"),
  productController.deleteProduct
);

export default router;
