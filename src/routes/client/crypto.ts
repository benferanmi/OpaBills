import { Router } from 'express';
import { CryptoController } from '@/controllers/client/CryptoController';
import { authenticate } from '@/middlewares/auth';
import { validateRequest, validateQuery } from '@/middlewares/validation';
import { buyCryptoSchema, sellCryptoSchema, cryptoTransactionQuerySchema } from '@/validations/client/cryptoValidation';

const router = Router();

const cryptoController = new CryptoController();

router.use(authenticate);

router.get('/', cryptoController.getCryptos);
router.get('/:cryptoId', cryptoController.getCryptoById);
router.post('/buy', validateRequest(buyCryptoSchema), cryptoController.buyCrypto);
router.post('/sell', validateRequest(sellCryptoSchema), cryptoController.sellCrypto);
router.get('/transactions/list', validateQuery(cryptoTransactionQuerySchema), cryptoController.getCryptoTransactions);
router.get('/transactions/:transactionId', cryptoController.getCryptoTransactionById);
router.get('/transactions/reference/:reference', cryptoController.getCryptoTransactionByReference);

export default router;
