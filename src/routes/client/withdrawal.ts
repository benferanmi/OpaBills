import { Router } from 'express';
import { WithdrawalController } from '@/controllers/client/WithdrawalController';
import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import { createWithdrawalRequestSchema, withdrawalQuerySchema } from '@/validations/client/withdrawalValidation';

const router = Router();

const withdrawalController = new WithdrawalController();

router.use(authenticate);
router.post('/', validateRequest(createWithdrawalRequestSchema), withdrawalController.createWithdrawalRequest);
router.get('/', validateQuery(withdrawalQuerySchema), withdrawalController.getWithdrawalRequests);
router.get('/:requestId', withdrawalController.getWithdrawalRequestById);

export default router;
