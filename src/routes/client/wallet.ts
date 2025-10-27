import { Router } from "express";
import { WalletController } from "@/controllers/client/WalletController";
import { authenticate } from "@/middlewares/auth";
import { walletLock } from "@/middlewares/walletLock";
import { profileComplete } from "@/middlewares/profileComplete";
import { rateLimiter } from "@/middlewares/rateLimiter";
import { validateRequest, validateQuery } from "@/middlewares/validation";
import {
  bankTransferSchema,
  fundWalletSchema,
  generateVirtualAccountSchema,
  walletTypeSchema,
} from "@/validations/client/walletValidation";

const router = Router();
const walletController = new WalletController();

// All routes require authentication
router.use(authenticate);

// Wallet balance routes
router.get("/", validateQuery(walletTypeSchema), walletController.getWallet);
router.get("/all", walletController.getAllWallets);
router.get("/balance-history", walletController.getBalanceHistory);

// Wallet transactions
router.get("/transactions", walletController.getWalletTransactions);
router.get("/ledger", walletController.getLedgerEntries);

// Wallet funding
router.post(
  "/fund",
  //   rateLimiter(5, 60000),
  walletLock,
  validateRequest(fundWalletSchema),
  walletController.fundWallet
);
router.post("/verify-transaction", walletController.verifyTransaction);
router.post(
  "/record-deposit",
  rateLimiter(3, 60000),
  walletController.recordDeposit
);

// Wallet transfer
router.post(
  "/transfer",
  rateLimiter(5, 60000),
  walletLock,
  profileComplete,
  walletController.transferFunds
);
router.post("/beneficiaries/verify", walletController.verifyBeneficiary);
router.get("/beneficiaries", walletController.getBeneficiaries);
router.post("/beneficiaries/search", walletController.searchBeneficiaries);

// Withdrawal & bank transfer
router.post(
  "/withdraw",
  rateLimiter(3, 60000),
  walletLock,
  profileComplete,
  walletController.withdrawFunds
);
router.post(
  "/bank-transfer",
  rateLimiter(5, 60000),
  validateRequest(bankTransferSchema),
  walletLock,
  profileComplete,
  walletController.bankTransfer
);

// Virtual accounts
router.get("/accounts", walletController.getVirtualAccounts);
router.post(
  "/accounts/generate",
  validateRequest(generateVirtualAccountSchema),
  // rateLimiter(2, 300000),
  walletController.generateVirtualAccount
);

export default router;
