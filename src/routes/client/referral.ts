import { Router } from 'express';
import { ReferralController } from '@/controllers/client/ReferralController';
import { ReferralService } from '@/services/client/ReferralService';
import { ReferralRepository } from '@/repositories/ReferralRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { WalletService } from '@/services/client/WalletService';
import { CacheService } from '@/services/CacheService';
import { authenticate } from '@/middlewares/auth';

const router = Router();

const referralRepository = new ReferralRepository();
const userRepository = new UserRepository();
const cacheService = new CacheService();
const walletService = new WalletService();
const referralService = new ReferralService(referralRepository, userRepository, walletService, cacheService);
const referralController = new ReferralController(referralService);

router.use(authenticate);
router.get('/', referralController.getReferralStats);
router.get('/referred-users', referralController.getReferredUsers);
router.get('/earnings', referralController.getReferralEarnings);
router.get('/terms', referralController.getReferralTerms);

export default router;
