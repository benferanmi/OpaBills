// import { Router } from "express";
// import { EmailTemplateController } from "@/controllers/admin/EmailTemplateController";
// import { adminAuth } from "@/middlewares/admin/adminAuth";
// import { requirePermission } from "@/middlewares/admin/adminPermission";
// import { ADMIN_PERMISSIONS } from "@/utils/admin-permissions";
// import { validateRequest } from "@/middlewares/validation";

// import {
//   createEmailTemplateValidation,
//   updateEmailTemplateValidation,
// } from "@/validations/admin/emailTemplateValidation";

// const router = Router();
// const emailTemplateController = new EmailTemplateController();

// router.use(adminAuth);

// router.get(
//   "/",
//   requirePermission(ADMIN_PERMISSIONS.SETTINGS.VIEW),
//   emailTemplateController.listEmailTemplates
// );

// router.post(
//   "/",
//   requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
//   validateRequest(createEmailTemplateValidation),
//   emailTemplateController.createEmailTemplate
// );

// router.get(
//   "/:id",
//   requirePermission(ADMIN_PERMISSIONS.SETTINGS.VIEW),
//   emailTemplateController.getEmailTemplateDetails
// );

// router.put(
//   "/:id",
//   requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
//   validateRequest(updateEmailTemplateValidation),
//   emailTemplateController.updateEmailTemplate
// );

// router.delete(
//   "/:id",
//   requirePermission(ADMIN_PERMISSIONS.SETTINGS.UPDATE),
//   emailTemplateController.deleteEmailTemplate
// );

// router.post(
//   "/render/:slug",
//   requirePermission(ADMIN_PERMISSIONS.SETTINGS.VIEW),
//   emailTemplateController.renderTemplate
// );

// export default router;
