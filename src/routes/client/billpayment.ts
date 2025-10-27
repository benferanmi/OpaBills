import { Router } from "express";
import { BillPaymentController } from "@/controllers/client/BillPaymentController";
import { authenticate } from "@/middlewares/auth";
import { validateRequest, validateQuery } from "@/middlewares/validation";
import {
  airtimePurchaseSchema,
  dataPurchaseSchema,
  cableTvSchema,
  electricitySchema,
  transactionQuerySchema,
} from "@/validations/client/billpaymentValidation";

const router = Router();

const billPaymentController = new BillPaymentController();

// Routes (all protected)
router.use(authenticate);
router.post(
  "/airtime",
  validateRequest(airtimePurchaseSchema),
  billPaymentController.purchaseAirtime
);
router.post(
  "/data",
  validateRequest(dataPurchaseSchema),
  billPaymentController.purchaseData
);
router.post(
  "/cable-tv",
  validateRequest(cableTvSchema),
  billPaymentController.purchaseCableTv
);
router.post(
  "/electricity",
  validateRequest(electricitySchema),
  billPaymentController.purchaseElectricity
);
router.get(
  "/transactions",
  validateQuery(transactionQuerySchema),
  billPaymentController.getBillPaymentTransactions
);

export default router;
