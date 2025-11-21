import { Router } from "express";
import { TransactionController } from "@/controllers/client/TransactionController";
import { authenticate } from "@/middlewares/auth";
import { validateQuery } from "@/middlewares/validation";
import { paginationSchema } from "@/validations/client/transactionValidation";

const router = Router();

const transactionController = new TransactionController();

// All routes require authentication
router.use(authenticate);

// Transaction queries
router.get(
  "/",
  validateQuery(paginationSchema),
  transactionController.getUserTransactions
);
router.get(
  "/export",
  validateQuery(paginationSchema),
  transactionController.exportTransactions
);

// Single transaction
router.get("/:reference", transactionController.getTransaction);
router.get("/:reference/receipt", transactionController.generateReceipt);

export default router;
