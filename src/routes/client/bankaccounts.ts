import { Router } from 'express';
import { BankAccountController } from '@/controllers/client/BankAccountController';
import { BankAccountService } from '@/services/client/BankAccountService';
import { BankAccountRepository } from '@/repositories/BankAccountRepository';
import { authenticate } from '@/middlewares/auth';
import { validateRequest } from '@/middlewares/validation';
import { createBankAccountSchema, verifyBankAccountSchema } from '@/validations/client/bankaccountValidation';

const router = Router();

// Initialize dependencies
const bankAccountRepository = new BankAccountRepository();
const bankAccountService = new BankAccountService();
const bankAccountController = new BankAccountController(bankAccountService);

// All routes require authentication
router.use(authenticate);

router.get('/', bankAccountController.getUserBankAccounts);
router.post('/', validateRequest(createBankAccountSchema), bankAccountController.createBankAccount);
router.post('/verify', validateRequest(verifyBankAccountSchema), bankAccountController.verifyBankAccount);
router.delete('/:id', bankAccountController.deleteBankAccount);
router.put('/:id/default', bankAccountController.setDefaultBankAccount);

export default router;
