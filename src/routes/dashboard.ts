import { Router } from 'express';
import { DashboardController } from '@/controllers/DashboardController';
import { DashboardService } from '@/services/DashboardService';
import { UserRepository } from '@/repositories/UserRepository';
import { WalletRepository } from '@/repositories/WalletRepository';
import { TransactionRepository } from '@/repositories/TransactionRepository';
import { NotificationRepository } from '@/repositories/NotificationRepository';
import { authenticate } from '@/middlewares/auth';

const router = Router();

// Initialize dependencies
const userRepository = new UserRepository();
const walletRepository = new WalletRepository();
const transactionRepository = new TransactionRepository();
const notificationRepository = new NotificationRepository();
const dashboardService = new DashboardService(
  userRepository,
  walletRepository,
  transactionRepository,
  notificationRepository
);
const dashboardController = new DashboardController(dashboardService);

// Routes (all protected)
router.use(authenticate);
router.get('/stats', dashboardController.getDashboardStats);

export default router;
