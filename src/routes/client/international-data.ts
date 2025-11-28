import { Router } from "express";
import { BillPaymentController } from "@/controllers/client/BillPaymentController";
import { authenticate } from "@/middlewares/auth";
import { serviceCheck } from "@/middlewares/serviceCheck";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { walletLock } from "@/middlewares/walletLock";
import { validateRequest } from "@/middlewares/validation";
import { checkAndVerifyPin } from "@/middlewares/checkAndVerifyPin";
import { purchaseInternationDataSchema } from "@/validations/client/billpaymentValidation";

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck("internationalData"));

router.get("/countries", billPaymentController.getInternationalDataCountries);
router.get(
  "/providers/:countryCode",
  billPaymentController.getInternationalDataProviders
);
router.get(
  "/products/:providerId",
  billPaymentController.getInternationalDataProducts
);
router.post(
  "/",
  rateLimiter(10, 60000),
  validateRequest(purchaseInternationDataSchema),
  checkAndVerifyPin,
  walletLock,
  billPaymentController.purchaseInternationalData
);

export default router;
