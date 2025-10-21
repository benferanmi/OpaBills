import { Router } from 'express';
import { BankAccountController } from '@/controllers/client/BankAccountController';
import { BankAccountService } from '@/services/client/BankAccountService';
import { BankAccountRepository } from '@/repositories/BankAccountRepository';
import { authenticate } from '@/middlewares/auth';
import { validateRequest } from '@/middlewares/validation';
import { createBankAccountSchema } from '@/validations/client/bankaccountValidation';

const router = Router();

// Initialize dependencies
const bankAccountRepository = new BankAccountRepository();
const bankAccountService = new BankAccountService(bankAccountRepository);
const bankAccountController = new BankAccountController(bankAccountService);

// Routes (all protected)
router.use(authenticate);
router.post('/', validateRequest(createBankAccountSchema), bankAccountController.createBankAccount);
router.get('/', bankAccountController.getUserBankAccounts);
router.get('/:id', bankAccountController.getBankAccount);
router.delete('/:id', bankAccountController.deleteBankAccount);

export default router;
