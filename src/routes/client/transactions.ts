import { Router } from "express";
import { TransactionController } from "@/controllers/client/TransactionController";

import { authenticate } from "@/middlewares/auth";
import { validateRequest, validateQuery } from "@/middlewares/validation";
import {
  createTransactionSchema,
  paginationSchema,
} from "@/validations/client/transactionValidation";

const router = Router();

const transactionController = new TransactionController();

// Routes (all protected)
router.use(authenticate);
router.post(
  "/",
  validateRequest(createTransactionSchema),
  transactionController.createTransaction
);
router.get(
  "/",
  validateQuery(paginationSchema),
  transactionController.getUserTransactions
);
router.get("/:reference", transactionController.getTransaction);

export default router;
