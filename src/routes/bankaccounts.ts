import { Router } from 'express';
import { BankAccountController } from '@/controllers/BankAccountController';
import { BankAccountService } from '@/services/BankAccountService';
import { BankAccountRepository } from '@/repositories/BankAccountRepository';
import { authenticate } from '@/middlewares/auth';
import { validateRequest } from '@/middlewares/validation';
import { createBankAccountSchema } from '@/validations/bankaccountValidation';

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
