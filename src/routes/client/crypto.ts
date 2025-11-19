import { Router } from "express";
import { CryptoController } from "@/controllers/client/CryptoController";
import { authenticate } from "@/middlewares/auth";
import {
  validateRequest,
  validateQuery,
  validateParams,
} from "@/middlewares/validation";
import {
  buyCryptoSchema,
  sellCryptoSchema,
  calculateBreakdownSchema,
  cryptoQuerySchema,
  cryptoIdParamSchema,
} from "@/validations/client/cryptoValidation";

const router = Router();
const cryptoController = new CryptoController();

router.use(authenticate);

/**
 * GET /api/cryptos
 * Get list of available cryptocurrencies
 */
router.get("/", validateQuery(cryptoQuerySchema), cryptoController.getCryptos);

/**
 * GET /api/cryptos/rates
 * Get current exchange rates for all cryptos
 * Note: This must come BEFORE /:cryptoId route
 */
router.get("/rates", cryptoController.getCryptoRates);

/**
 * POST /api/cryptos/calculate-breakdown
 * Calculate transaction breakdown (preview amounts)
 */
router.post(
  "/calculate-breakdown",
  validateRequest(calculateBreakdownSchema),
  cryptoController.calculateBreakdown
);

/**
 * POST /api/cryptos/buy
 * Initiate crypto purchase (user pays fiat, gets crypto)
 */
router.post(
  "/buy",
  validateRequest(buyCryptoSchema),
  cryptoController.buyCrypto
);

/**
 * POST /api/cryptos/sell
 * Initiate crypto sale (user sends crypto, gets fiat)
 */
router.post(
  "/sell",
  validateRequest(sellCryptoSchema),
  cryptoController.sellCrypto
);

/**
 * GET /api/cryptos/:cryptoId
 * Get single cryptocurrency details
 */
router.get(
  "/:cryptoId",
  validateParams(cryptoIdParamSchema),
  cryptoController.getCryptoById
);

/**
 * GET /api/cryptos/:cryptoId/networks
 * Get available networks for a cryptocurrency
 */
router.get(
  "/:cryptoId/networks",
  validateParams(cryptoIdParamSchema),
  cryptoController.getCryptoNetworks
);

export default router;
