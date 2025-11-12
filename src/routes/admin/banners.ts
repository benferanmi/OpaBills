import { Router } from "express";
import { BannerController } from "@/controllers/admin/BannerController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { auditLog } from "@/middlewares/admin/auditLogger";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";

import {
  createBannerValidation,
  updateBannerValidation,
} from "@/validations/admin/bannerValidation";

const router = Router();
const bannerController = new BannerController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_BANNERS),
  bannerController.listBanners
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_BANNERS),
  validateRequest(createBannerValidation),
  auditLog("create", "banner"),
  bannerController.createBanner
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_BANNERS),
  bannerController.getBannerDetails
);

router.put(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_BANNERS),
  validateRequest(updateBannerValidation),
  auditLog("update", "banner"),
  bannerController.updateBanner
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_BANNERS),
  auditLog("delete", "banner"),
  bannerController.deleteBanner
);

export default router;
