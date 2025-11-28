import { Router } from "express";
import { BillPaymentController } from "@/controllers/client/BillPaymentController";
import { authenticate } from "@/middlewares/auth";
import { walletLock } from "@/middlewares/walletLock";
import { serviceCheck } from "@/middlewares/serviceCheck";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { validateRequest } from "@/middlewares/validation";
import { dataPurchaseSchema } from "@/validations/client/billpaymentValidation";
import { checkAndVerifyPin } from "@/middlewares/checkAndVerifyPin";

const router = Router();

const billPaymentController = new BillPaymentController();

// All routes require authentication and service check
router.use(authenticate);
router.use(serviceCheck("data"));

// Get data services by type (SME, GIFTING, DIRECT)
router.get("/providers", billPaymentController.getDataProviders);
router.post("/verify", billPaymentController.verifyPhone);

router.get("/", billPaymentController.getData);
// Get data types (SME, GIFTING, DIRECT)
// Get data products by service (MTN data, Airtel data.....)
router.get("/:providerId/:dataType", billPaymentController.getDataProducts);
router.post(
  "/",
  rateLimiter(10, 60000),
  validateRequest(dataPurchaseSchema),
  checkAndVerifyPin,
  walletLock,
  billPaymentController.purchaseData
);

export default router;
