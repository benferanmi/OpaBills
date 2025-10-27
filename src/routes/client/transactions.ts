import { Router } from 'express';
import { TransactionController } from '@/controllers/client/TransactionController';
import { authenticate } from '@/middlewares/auth';
import { validateQuery } from '@/middlewares/validation';
import { paginationSchema } from '@/validations/client/transactionValidation';

const router = Router();

const transactionController = new TransactionController();

// All routes require authentication
router.use(authenticate);

// Transaction queries
router.get('/', validateQuery(paginationSchema), transactionController.getUserTransactions);
router.get('/stats', transactionController.getTransactionStats);
router.get('/recent', transactionController.getRecentTransactions);
router.get('/export', transactionController.exportTransactions);
router.get('/types', transactionController.getTransactionTypes);
router.get('/providers', transactionController.getTransactionProviders);

// Single transaction
router.get('/:reference', transactionController.getTransaction);
router.post('/receipt/:reference', transactionController.generateReceipt);

export default router;
