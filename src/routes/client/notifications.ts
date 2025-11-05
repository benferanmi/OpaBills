import { Router } from "express";
import { NotificationController } from "@/controllers/client/NotificationController";
import { NotificationService } from "@/services/client/NotificationService";
import { authenticate } from "@/middlewares/auth";
import { validateQuery } from "@/middlewares/validation";
import { paginationSchema } from "@/validations/client/transactionValidation";

const router = Router();

const notificationService = new NotificationService();
const notificationController = new NotificationController(notificationService);

// Routes (all protected)
router.use(authenticate);
router.get(
  "/",
  validateQuery(paginationSchema),
  notificationController.getUserNotifications
);
router.get("/unread", notificationController.getUnreadNotifications);
router.get("/unread-count", notificationController.getUnreadCount);
router.get("/:id", notificationController.getNotificationById);
router.put("/:id/read", notificationController.markAsRead);
router.put("/:id/unread", notificationController.markAsUnread);
router.put("/mark-all-read", notificationController.markAllAsRead);
router.delete("/:id", notificationController.deleteNotification);
router.delete("/clear-all", notificationController.clearAllNotifications);

export default router;
