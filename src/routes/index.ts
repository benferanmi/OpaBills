import { Router } from 'express';
import authRoutes from './auth';
import profileRoutes from './profile';
import walletRoutes from './wallet';
import transactionRoutes from './transactions';
import notificationRoutes from './notifications';
import bankAccountRoutes from './bankaccounts';
import dashboardRoutes from './dashboard';
import referenceRoutes from './reference';
import billPaymentRoutes from './billpayment';
import giftCardRoutes from './giftcard';

const router = Router();

// API routes
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);
router.use('/wallet', walletRoutes);
router.use('/transactions', transactionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/bank-accounts', bankAccountRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reference', referenceRoutes);
router.use('/bill-payments', billPaymentRoutes);
router.use('/gift-cards', giftCardRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

export default router;
