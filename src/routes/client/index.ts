import { Router } from 'express';

// Auth & Profile
import authRoutes from './auth';
import profileRoutes from './profile';

// Wallet & Transactions
import walletRoutes from './wallet';
import transactionRoutes from './transactions';

// Bill Payments - Separated Services
import airtimeRoutes from './airtime';
import dataRoutes from './data';
import electricityRoutes from './electricity';
import tvRoutes from './tv-subscription';
import bettingRoutes from './betting';
import epinRoutes from './e-pin';
import internationalAirtimeRoutes from './international-airtime';
import internationalDataRoutes from './international-data';

// Financial Services
import giftCardRoutes from './giftcards';
import giftCardTransactionRoutes from './giftcard-transactions';
import cryptoRoutes from './crypto';
import cryptoTransactionRoutes from './crypto-transactions';

// Banking
import bankAccountRoutes from './bankaccounts';
import depositRoutes from './deposit';
import withdrawalRoutes from './withdrawal';

// Travel
import flightRoutes from './flights';

// System & Support
import notificationRoutes from './notifications';
import dashboardRoutes from './dashboard';
import referralRoutes from './referral';
import referenceRoutes from './reference';
import faqRoutes from './faqs';

// Webhooks
import webhookRoutes from './webhooks';

// Public routes
import publicRoutes from './public';

const router = Router();

// ============= AUTHENTICATED ROUTES =============

// Auth & Profile
router.use('/auth', authRoutes);
router.use('/profile', profileRoutes);

// Wallet & Transactions
router.use('/wallet', walletRoutes);
router.use('/transactions', transactionRoutes);

// Bill Payment Services
router.use('/airtime', airtimeRoutes);
router.use('/data', dataRoutes);
router.use('/electricity', electricityRoutes);
router.use('/tv-subscription', tvRoutes);
router.use('/betting', bettingRoutes);
router.use('/e-pin', epinRoutes);
router.use('/international-airtime', internationalAirtimeRoutes);
router.use('/international-data', internationalDataRoutes);

// Gift Cards & Crypto
router.use('/giftcards', giftCardRoutes);
router.use('/giftcard-transactions', giftCardTransactionRoutes);
router.use('/crypto', cryptoRoutes);
router.use('/crypto-transactions', cryptoTransactionRoutes);

// Banking
router.use('/bank-accounts', bankAccountRoutes);
router.use('/deposits', depositRoutes);
router.use('/withdrawals', withdrawalRoutes);

// Travel
router.use('/flights', flightRoutes);

// System & Support
router.use('/notifications', notificationRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/referrals', referralRoutes);
router.use('/reference', referenceRoutes);
router.use('/faqs', faqRoutes);

// ============= WEBHOOK ROUTES (No Auth) =============
router.use('/webhooks', webhookRoutes);

// ============= PUBLIC ROUTES (No Auth) =============
router.use('/', publicRoutes);

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

export default router;
