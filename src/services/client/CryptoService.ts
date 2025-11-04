import {
  CryptoRepository,
  CryptoTransactionRepository,
} from "@/repositories/CryptoRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { ProviderService } from "./ProviderService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { generateReference } from "@/utils/helpers";

export class CryptoService {
  private cryptoRepository: CryptoRepository;
  private cryptoTransactionRepository: CryptoTransactionRepository;
  private transactionRepository: TransactionRepository;
  private bankAccountRepository: BankAccountRepository;
  private walletService: WalletService;
  private providerService: ProviderService;
  private notificationRepository: NotificationRepository;
  constructor() {
    this.cryptoRepository = new CryptoRepository();
    this.cryptoTransactionRepository = new CryptoTransactionRepository();
    this.transactionRepository = new TransactionRepository();
    this.bankAccountRepository = new BankAccountRepository();
    this.walletService = new WalletService();
    this.providerService = new ProviderService();
    this.notificationRepository = new NotificationRepository();
  }

  async getCryptos(filters: any = {}, page: number = 1, limit: number = 10) {
    if (filters.search) {
      return this.cryptoRepository.searchCryptos(filters.search, page, limit);
    }
    return this.cryptoRepository.findActive(filters, page, limit);
  }

  async getCryptoById(cryptoId: string) {
    const crypto = await this.cryptoRepository.findById(cryptoId);
    if (!crypto || crypto.deletedAt) {
      throw new AppError(
        "Crypto not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return crypto;
  }

  async buyCrypto(data: {
    userId: string;
    cryptoId: string;
    amount: number;
    walletAddress: string;
    network: any;
  }) {
    const reference = generateReference();

    // Get crypto
    const crypto = await this.getCryptoById(data.cryptoId);

    // Validate purchase is activated
    if (!crypto.purchaseActivated) {
      throw new AppError(
        "Crypto purchase is not activated",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate amount limits
    if (crypto.buyMinAmount && data.amount < crypto.buyMinAmount) {
      throw new AppError(
        `Minimum purchase amount is ${crypto.buyMinAmount}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    if (crypto.buyMaxAmount && data.amount > crypto.buyMaxAmount) {
      throw new AppError(
        `Maximum purchase amount is ${crypto.buyMaxAmount}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Get user wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Calculate total
    const serviceCharge = 0; // Can be configured
    const rate = crypto.buyRate || 1;
    const totalAmount = data.amount * rate + serviceCharge;

    // Check balance
    if (wallet.balance < totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct from wallet
    await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "Crypto purchase",
      "main"
    );

    // Create crypto transaction
    const cryptoTransaction = await this.cryptoTransactionRepository.create({
      cryptoId: crypto.id,
      userId: new Types.ObjectId(data.userId),
      reference,
      tradeType: "buy",
      walletAddress: data.walletAddress,
      amount: data.amount,
      serviceCharge,
      rate,
      payableAmount: totalAmount,
      network: data.network,
      status: "pending",
    });

    // Create main transaction
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "CryptoTransaction",
      transactableId: cryptoTransaction.id,
      reference,
      amount: totalAmount,
      type: "crypto_purchase",
      provider: "internal",
      remark: `Crypto purchase: ${crypto.name}`,
      purpose: "crypto_purchase",
      status: "pending",
      meta: { cryptoName: crypto.name, walletAddress: data.walletAddress },
    });

    // Update crypto transaction with transaction ID
    await this.cryptoTransactionRepository.update(cryptoTransaction.id, {
      transactionId: transaction._id,
    });

    // Call provider API
    try {
      const providerResponse = {
        success: true,
      };
      // await this.providerService.purchaseCrypto({
      //   cryptoId: data.cryptoId,
      //   amount: data.amount,
      //   walletAddress: data.walletAddress,
      //   network: data.network,
      // });

      // Update statuses
      const status = providerResponse.success ? "success" : "failed";
      await this.cryptoTransactionRepository.updateStatus(
        cryptoTransaction.id,
        status
      );
      await this.transactionRepository.updateStatus(transaction.id, status);

      // Send notification
      await this.notificationRepository.create({
        type:
          status === "success" ? "transaction_success" : "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "Crypto Purchase",
          amount: totalAmount,
          reference,
          cryptoName: crypto.name,
        },
      });

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "Crypto purchase failed - refund",
          "main"
        );
      }

      return {
        ...cryptoTransaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.cryptoTransactionRepository.updateStatus(
        cryptoTransaction.id,
        "failed"
      );
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "Crypto purchase error - refund",
        "main"
      );

      // Send failure notification
      await this.notificationRepository.create({
        type: "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "Crypto Purchase",
          amount: totalAmount,
          reference,
          cryptoName: crypto.name,
        },
      });

      throw error;
    }
  }

  async sellCrypto(data: {
    userId: string;
    cryptoId: string;
    amount: number;
    comment?: string;
    proof: string;
    bankAccountId: string;
  }) {
    const reference = generateReference();

    // Get crypto
    const crypto = await this.getCryptoById(data.cryptoId);

    // Validate sale is activated
    if (!crypto.saleActivated) {
      throw new AppError(
        "Crypto sale is not activated",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate amount limits
    if (crypto.sellMinAmount && data.amount < crypto.sellMinAmount) {
      throw new AppError(
        `Minimum sell amount is ${crypto.sellMinAmount}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    if (crypto.sellMaxAmount && data.amount > crypto.sellMaxAmount) {
      throw new AppError(
        `Maximum sell amount is ${crypto.sellMaxAmount}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Get bank account
    const bankAccount = await this.bankAccountRepository.findById(
      data.bankAccountId
    );
    if (!bankAccount || bankAccount.userId.toString() !== data.userId) {
      throw new AppError(
        "Invalid bank account",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Calculate payable amount
    const rate = crypto.sellRate || 1;
    const payableAmount = data.amount * rate;

    // Create crypto transaction (pending approval)
    const cryptoTransaction = await this.cryptoTransactionRepository.create({
      cryptoId: crypto.id,
      userId: new Types.ObjectId(data.userId),
      reference,
      tradeType: "sell",
      comment: data.comment,
      amount: data.amount,
      rate,
      payableAmount,
      proof: data.proof,
      status: "pending",
      bankCode: bankAccount.bankCode,
      accountName: bankAccount.accountName,
      accountNumber: bankAccount.accountNumber,
    });

    return cryptoTransaction;
  }

  async getCryptoTransactions(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {};

    if (filters.tradeType) {
      query.tradeType = filters.tradeType;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    return this.cryptoTransactionRepository.findByUserId(
      userId,
      query,
      page,
      limit
    );
  }

  async getCryptoTransactionById(transactionId: string) {
    const transaction = await this.cryptoTransactionRepository.findById(
      transactionId
    );
    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return transaction;
  }

  async getCryptoTransactionByReference(reference: string) {
    const transaction = await this.cryptoTransactionRepository.findByReference(
      reference
    );
    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return transaction;
  }

  async getCryptoRates() {
    const cryptos = await this.cryptoRepository.findWithPagination(
      { deletedAt: null },
      1,
      100
    );

    return cryptos.data.map((crypto: any) => ({
      id: crypto._id,
      name: crypto.name,
      code: crypto.code,
      logo: crypto.logo,
      buyRate: crypto.buyRate,
      sellRate: crypto.sellRate,
      saleActivated: crypto.saleActivated,
      purchaseActivated: crypto.purchaseActivated,
    }));
  }

  async getCryptoNetworks(cryptoId: string) {
    const crypto = await this.getCryptoById(cryptoId);

    // Return networks from crypto config
    return (
      crypto.networks || [
        { id: "erc20", name: "Ethereum (ERC20)", code: "ERC20" },
        { id: "trc20", name: "Tron (TRC20)", code: "TRC20" },
        { id: "bep20", name: "BSC (BEP20)", code: "BEP20" },
      ]
    );
  }

  async calculateBreakdown(data: {
    cryptoId: string;
    amount: number;
    tradeType: "buy" | "sell";
  }) {
    const crypto = await this.getCryptoById(data.cryptoId);

    const rate = data.tradeType === "buy" ? crypto.buyRate : crypto.sellRate;
    const serviceCharge = 0; // Can be configured

    let payableAmount: number;
    if (data.tradeType === "buy") {
      payableAmount = data.amount * (rate || 1) + serviceCharge;
    } else {
      payableAmount = data.amount * (rate || 1);
    }

    return {
      crypto: {
        id: crypto._id,
        name: crypto.name,
        code: crypto.code,
        logo: crypto.icon,
      },
      amount: data.amount,
      rate,
      serviceCharge,
      payableAmount,
      tradeType: data.tradeType,
    };
  }
}
