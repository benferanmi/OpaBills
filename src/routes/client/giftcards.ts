import { Router } from "express";
import { GiftCardController } from "@/controllers/client/GiftCardController";
import { authenticate } from "@/middlewares/auth";
import { validateRequest, validateQuery } from "@/middlewares/validation";
import {
  buyGiftCardSchema,
  sellGiftCardSchema,
  breakdownSchema,
  giftCardTransactionQuerySchema,
} from "@/validations/client/giftcardValidation";
import { paginationSchema } from "@/validations/client/transactionValidation";
import { checkAndVerifyPin } from "@/middlewares/checkAndVerifyPin";
import { walletLock } from "@/middlewares/walletLock";

const router = Router();
const giftCardController = new GiftCardController();

router.use(authenticate);

// Categories
router.get(
  "/categories",
  validateQuery(paginationSchema),
  giftCardController.getCategories
);
router.get("/categories/:categoryId", giftCardController.getCategoryById);

// Products
router.get("/", giftCardController.getGiftCards);
router.get("/products/:giftCardId", giftCardController.getGiftCardById);
router.get("/giftcard-rates", giftCardController.getRates);
router.get("/:type", giftCardController.getGiftCardsByType);

// Breakdown
router.post(
  "/breakdown",
  validateRequest(breakdownSchema),
  giftCardController.getBreakdown
);

// Transactions
router.post(
  "/buy",
  validateRequest(buyGiftCardSchema),
  checkAndVerifyPin,
  walletLock,
  giftCardController.buyGiftCard
);
router.post(
  "/sell",
  validateRequest(sellGiftCardSchema),
  checkAndVerifyPin,
  giftCardController.sellGiftCard
);

// Transaction Management
router.get(
  "/transactions/:transactionId/redeem-code",
  giftCardController.getRedeemCode
);
router.get(
  "/transactions/list",
  validateQuery(giftCardTransactionQuerySchema),
  giftCardController.getGiftCardTransactions
);
router.get(
  "/transactions/:transactionId",
  giftCardController.getGiftCardTransactionById
);
router.get(
  "/transactions/reference/:reference",
  giftCardController.getGiftCardTransactionByReference
);

export default router;
