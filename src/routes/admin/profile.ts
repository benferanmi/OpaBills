import { ProfileController } from "@/controllers/admin/profileController";
import { verifyAdminToken } from "@/middlewares/admin/auth";
import { validateRequest } from "@/middlewares/validation";
import { AdminAuthenticatedRequest } from "@/types/admin";
import { rateLimiter } from "@/utils/constants";
import { updateAdminProfileSchema, toggle2FASchema } from "@/validations/admin/accountValidation";

import {
  changePasswordSchema,
} from "@/validations/client/authValidation";
import { Router } from "express";

const router = Router();
const profileController = new ProfileController();

router.use(verifyAdminToken as any);
// router.use(rateLimiter.general);

router.patch(
  "/change-password",
  validateRequest(changePasswordSchema),
  (req, res, next) =>
    profileController.changePassword(
      req as AdminAuthenticatedRequest,
      res,
      next
    )
);

router.patch("/", validateRequest(updateAdminProfileSchema), (req, res, next) =>
  profileController.updateProfile(req as AdminAuthenticatedRequest, res, next)
);

router.patch("/toggle-2fa", validateRequest(toggle2FASchema), (req, res) =>
  profileController.toggle2FA(req as AdminAuthenticatedRequest, res)
);

router.get("/", (req, res, next) =>
  profileController.getProfile(req as AdminAuthenticatedRequest, res, next)
);

export default router;
