import { Router } from "express";
import { CryptoController } from "@/controllers/client/CryptoController";

import { authenticate } from "@/middlewares/auth";
import { validateQuery } from "@/middlewares/validation";
import { cryptoTransactionQuerySchema } from "@/validations/client/cryptoValidation";

const router = Router();

const cryptoController = new CryptoController();

// All routes require authentication
router.use(authenticate);

router.get(
  "/",
  validateQuery(cryptoTransactionQuerySchema),
  cryptoController.getCryptoTransactions
);
// router.get("/pending", cryptoController.getPendingCryptoTransactions);
// router.get("/completed", cryptoController.getCompletedCryptoTransactions);
// router.get("/stats", cryptoController.getCryptoTransactionStats);
router.get("/:id", cryptoController.getCryptoTransactionById);
// router.put("/:id/upload-proof", cryptoController.uploadTransactionProof);

export default router;
