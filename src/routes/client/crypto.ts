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

router.get("/", validateQuery(cryptoQuerySchema), cryptoController.getCryptos);

// Get current exchange rates for all cryptos
router.get("/rates", cryptoController.getCryptoRates);

// Calculate transaction breakdown (preview amounts)
router.post(
  "/calculate-breakdown",
  validateRequest(calculateBreakdownSchema),
  cryptoController.calculateBreakdown
);

// Initiate crypto purchase (user pays fiat, gets crypto)
router.post(
  "/buy",
  validateRequest(buyCryptoSchema),
  cryptoController.buyCrypto
);

// Initiate crypto sale (user sends crypto, gets fiat)
router.post(
  "/sell",
  validateRequest(sellCryptoSchema),
  cryptoController.sellCrypto
);

// Get single cryptocurrency details
router.get(
  "/:cryptoId",
  validateParams(cryptoIdParamSchema),
  cryptoController.getCryptoById
);

// Get available networks for a cryptocurrency
router.get(
  "/:cryptoId/networks",
  validateParams(cryptoIdParamSchema),
  cryptoController.getCryptoNetworks
);

export default router;
