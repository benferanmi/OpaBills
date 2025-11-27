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
  identificationSchema,
  verifyOtpAndCreateAccountSchema,
  walletTypeSchema,
  transferSchema,
} from "@/validations/client/walletValidation";
import { VirtualAccountController } from "@/controllers/client/VirtualAccountController ";
import { checkAndVerifyPin } from "@/middlewares/checkAndVerifyPin";

const router = Router();
const walletController = new WalletController();
const virtualAccountController = new VirtualAccountController();

// All routes require authentication
router.use(authenticate);

// Wallet balance routes
router.get("/", validateQuery(walletTypeSchema), walletController.getWallet);
router.get("/all", walletController.getAllWallets);
router.get("/balance-history", walletController.getBalanceHistory);

// Wallet transactions
router.get("/transactions", walletController.getWalletTransactions);

// Wallet funding
router.post(
  "/fund",
  //   rateLimiter(5, 60000),
  walletLock,
  validateRequest(fundWalletSchema),
  walletController.fundWallet
);

router.get("/providers", walletController.getProviders);
router.post("/verify-transaction", walletController.verifyTransaction);
router.post(
  "/record-deposit",
  rateLimiter(3, 60000),
  walletController.recordDeposit
);

// Wallet transfer
router.post(
  "/transfer",
  // rateLimiter(5, 60000),
  walletLock,
  profileComplete,
  validateRequest(transferSchema),
  walletController.transferFunds
);
router.post("/beneficiaries/verify", walletController.verifyBeneficiary);
router.get("/beneficiaries", walletController.getBeneficiaries);
router.get("/beneficiaries/:search", walletController.searchBeneficiaries);

// Withdrawal & bank transfer
router.post(
  "/withdraw",
  // rateLimiter(3, 60000),
  checkAndVerifyPin,
  walletLock,
  profileComplete,
  walletController.withdrawFunds
);
router.post(
  "/bank-transfer",
  // rateLimiter(5, 60000),
  validateRequest(bankTransferSchema),
  checkAndVerifyPin,
  walletLock,
  profileComplete,
  walletController.bankTransfer
);

// Virtual accounts
router.post(
  "/accounts/initiate",
  validateRequest(identificationSchema),
  profileComplete,
  virtualAccountController.initiateVirtualAccountGeneration
);
router.post(
  "/accounts/verify",
  validateRequest(verifyOtpAndCreateAccountSchema),
  virtualAccountController.verifyOTPAndCreateAccount
);
router.get(
  "/account/validation-status/:identityId",
  virtualAccountController.getValidationStatus
);
router.get("/accounts", virtualAccountController.getUserVirtualAccount);
// router.post(
//   "/accounts/generate",
//   validateRequest(generateVirtualAccountSchema),
//   // rateLimiter(2, 300000),
//   profileComplete,
//   virtualAccountController.generateVirtualAccount
// );

export default router;
