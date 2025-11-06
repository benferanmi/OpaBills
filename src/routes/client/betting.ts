import { Router } from "express";
import { BillPaymentController } from "@/controllers/client/BillPaymentController";

import { authenticate } from "@/middlewares/auth";
import { walletLock } from "@/middlewares/walletLock";
import { serviceCheck } from "@/middlewares/serviceCheck";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { checkAndVerifyPin } from "@/middlewares/checkAndVerifyPin";
import { validateRequest } from "@/middlewares/validation";
import { bettingPurchaseSchema } from "@/validations/client/billpaymentValidation";

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck("betting"));

router.get("/providers", billPaymentController.getBettingProviders);
router.post("/verify", billPaymentController.verifyBettingAccount);
router.post(
  "/",
  rateLimiter(10, 60000),
  validateRequest(bettingPurchaseSchema),
  checkAndVerifyPin,
  walletLock,
  billPaymentController.fundBetting
);
router.get("/history", billPaymentController.getBettingHistory);

export default router;
