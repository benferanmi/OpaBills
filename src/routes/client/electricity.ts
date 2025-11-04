import { Router } from "express";
import { BillPaymentController } from "@/controllers/client/BillPaymentController";
import { authenticate } from "@/middlewares/auth";
import { walletLock } from "@/middlewares/walletLock";
import { serviceCheck } from "@/middlewares/serviceCheck";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { validateRequest } from "@/middlewares/validation";
import {
  electricitySchema,
  verifyElectricitySchema,
} from "@/validations/client/billpaymentValidation";
import { checkAndVerifyPin } from "@/middlewares/checkAndVerifyPin";

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck("electricity"));

router.get("/providers", billPaymentController.getElectricityProviders);
router.post(
  "/verify",
  validateRequest(verifyElectricitySchema),
  billPaymentController.verifyMeterNumber
);
router.post(
  "/",
  rateLimiter(10, 60000),
  validateRequest(electricitySchema),
  checkAndVerifyPin,
  walletLock,
  billPaymentController.purchaseElectricity
);
// router.get('/history', billPaymentController.getElectricityHistory);

export default router;
