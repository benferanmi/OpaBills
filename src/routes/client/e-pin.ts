import { Router } from "express";
import { BillPaymentController } from "@/controllers/client/BillPaymentController";

import { authenticate } from "@/middlewares/auth";
import { walletLock } from "@/middlewares/walletLock";
import { serviceCheck } from "@/middlewares/serviceCheck";
import { rateLimiter } from "@/middlewares/rateLimiter";

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck("epin"));

router.get("/", billPaymentController.getEPinServices);
router.get("/:service", billPaymentController.getEPinProducts);
router.post("/verify", billPaymentController.verifyEPinMerchant);
router.post(
  "/",
  rateLimiter(10, 60000),
  walletLock,
  billPaymentController.purchaseEPin
);
router.get("/history", billPaymentController.getEPinHistory);

export default router;
