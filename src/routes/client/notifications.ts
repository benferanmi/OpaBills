import { Router } from 'express';
import { NotificationController } from '@/controllers/client/NotificationController';
import { NotificationService } from '@/services/client/NotificationService';
import { NotificationRepository } from '@/repositories/NotificationRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { authenticate } from '@/middlewares/auth';
import { validateQuery } from '@/middlewares/validation';
import { paginationSchema } from '@/validations/client/transactionValidation';

const router = Router();

// Initialize dependencies
const notificationRepository = new NotificationRepository();
const userRepository = new UserRepository();
const notificationService = new NotificationService(notificationRepository, userRepository);
const notificationController = new NotificationController(notificationService);

// Routes (all protected)
router.use(authenticate);
router.get('/', validateQuery(paginationSchema), notificationController.getUserNotifications);
router.get('/unread', notificationController.getUnreadNotifications);
router.get('/unread-count', notificationController.getUnreadCount);
router.get('/:id', notificationController.getNotificationById);
router.put('/:id/read', notificationController.markAsRead);
router.put('/:id/unread', notificationController.markAsUnread);
router.put('/mark-all-read', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/clear-all', notificationController.clearAllNotifications);

export default router;
