import { Router } from "express";
import { BillPaymentController } from "@/controllers/client/BillPaymentController";

import { authenticate } from "@/middlewares/auth";
import { walletLock } from "@/middlewares/walletLock";
import { serviceCheck } from "@/middlewares/serviceCheck";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { validateRequest } from "@/middlewares/validation";
import { airtimePurchaseSchema } from "@/validations/client/billpaymentValidation";

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck("airtime"));

// router.get("/providers", billPaymentController.getAirtimeProviders);
// router.post("/verify", billPaymentController.verifyPhone);
router.post(
  "/",
  rateLimiter(10, 60000),
  walletLock,
  validateRequest(airtimePurchaseSchema),
  billPaymentController.purchaseAirtime
);
// router.get("/history", billPaymentController.getAirtimeHistory);
// router.post(
//   "/bulk",
//   rateLimiter(3, 60000),
//   walletLock,
//   billPaymentController.bulkPurchaseAirtime
// );

export default router;
