import { Router } from 'express';
import authRoutes from './auth';
import userRoutes from './users';
import transactionRoutes from './transactions';
import depositRoutes from './deposits';
import withdrawalRoutes from './withdrawals';
import dashboardRoutes from './dashboard';
import alertRoutes from './alerts';
import profileRoutes from './profile';
import bannerRoutes from './banners';
import settingsRoutes from './settings';
import providerRoutes from './providers';
import productRoutes from './products';
import roleRoutes from './roles';
import faqRoutes from './faqs';
import adminRoutes from './admins';
import auditLogRoutes from './auditlogs';
import systemBankAccountRoutes from './system-bank-accounts';
import appVersionRoutes from './app-versions';
import serviceChargeRoutes from './service-charges';
import discountRoutes from './discounts';
import routeActionRoutes from './route-actions';
import cryptoTransactionRoutes from './crypto-transactions';
import giftCardTransactionRoutes from './giftcard-transactions';
import serviceTypeRoutes from './service-types';
import reportRoutes from './reports';
import uploadRoutes from './uploads';
// import emailTemplateRoutes from './email-templates';
import bulkOperationRoutes from './bulk-operations';

const router = Router();

// Admin routes
router.use('/auth', authRoutes);
router.use("/profile", profileRoutes)
router.use('/users', userRoutes);
router.use('/transactions', transactionRoutes);
router.use('/deposits', depositRoutes);
router.use('/withdrawals', withdrawalRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/alerts', alertRoutes);
router.use('/banners', bannerRoutes);
router.use('/settings', settingsRoutes);
router.use('/providers', providerRoutes);
router.use('/products', productRoutes);
router.use('/roles', roleRoutes);
router.use('/faqs', faqRoutes);
router.use('/admins', adminRoutes);
router.use('/auditlogs', auditLogRoutes);
router.use('/system-bank-accounts', systemBankAccountRoutes);
router.use('/app-versions', appVersionRoutes);
router.use('/service-charges', serviceChargeRoutes);
router.use('/discounts', discountRoutes);
router.use('/route-actions', routeActionRoutes);
router.use('/crypto-transactions', cryptoTransactionRoutes);
router.use('/giftcard-transactions', giftCardTransactionRoutes);
router.use('/service-types', serviceTypeRoutes);
router.use('/reports', reportRoutes);
router.use('/uploads', uploadRoutes);
// router.use('/email-templates', emailTemplateRoutes);
router.use('/bulk-operations', bulkOperationRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'admin-api',
  });
});

export default router;
