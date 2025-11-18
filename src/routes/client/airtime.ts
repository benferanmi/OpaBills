import { Router } from "express";
import { BillPaymentController } from "@/controllers/client/BillPaymentController";

import { authenticate } from "@/middlewares/auth";
import { walletLock } from "@/middlewares/walletLock";
import { serviceCheck } from "@/middlewares/serviceCheck";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { validateRequest } from "@/middlewares/validation";
import {
  airtimePurchaseSchema,
  verifyPhoneNumberSchema,
} from "@/validations/client/billpaymentValidation";
import { checkAndVerifyPin } from "@/middlewares/checkAndVerifyPin";

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck("airtime"));

router.get("/providers", billPaymentController.getAirtimeProviders);
router.post(
  "/verify",
  validateRequest(verifyPhoneNumberSchema),
  billPaymentController.verifyPhone
);
router.post(
  "/verify-number",
  validateRequest(verifyPhoneNumberSchema),
  billPaymentController.verifyPhoneWithNetwork
);
router.post(
  "/",
  rateLimiter(10, 60000),
  checkAndVerifyPin,
  walletLock,
  validateRequest(airtimePurchaseSchema),
  billPaymentController.purchaseAirtime
);
router.get("/history", billPaymentController.getAirtimeHistory);

export default router;
