import { Router } from "express";
import { FAQController } from "@/controllers/admin/FAQController";
import { adminAuth } from "@/middlewares/admin/adminAuth";
import { requirePermission } from "@/middlewares/admin/adminPermission";
import { auditLog } from "@/middlewares/admin/auditLogger";
import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
import { validateRequest } from "@/middlewares/validation";

import {
  createFaqValidation,
  updateFaqValidation,
} from "@/validations/admin/faqValidation";

const router = Router();
const faqController = new FAQController();

router.use(adminAuth);

router.get(
  "/",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_FAQS),
  faqController.listFAQs
);

router.post(
  "/",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_FAQS),
  validateRequest(createFaqValidation),
  auditLog("create", "faq"),
  faqController.createFAQ
);

router.get(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_FAQS),
  faqController.getFAQDetails
);

router.post(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_FAQS),
  validateRequest(updateFaqValidation),
  auditLog("update", "faq"),
  faqController.updateFAQ
);

router.delete(
  "/:id",
  requirePermission(ADMIN_PERMISSIONS.CONTENT.MANAGE_FAQS),
  auditLog("delete", "faq"),
  faqController.deleteFAQ
);

export default router;
