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
import { generateReference } from "@/utils/helpers";

interface BuyCryptoData {
  userId: string;
  cryptoId: string;
  cryptoAmount: number; // Amount of crypto user wants (e.g., 100 USDT)
  walletAddress: string;
  networkId: string; // Selected network ID from crypto.networks
}

interface SellCryptoData {
  userId: string;
  cryptoId: string;
  cryptoAmount: number; // Amount of crypto user is selling
  networkId: string;
  comment?: string;
  proof: string; // Screenshot/txHash proof
  bankAccountId: string;
}

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

  /**
   * Get list of available cryptos with filters
   */
  async getCryptos(filters: any = {}, page: number = 1, limit: number = 10) {
    const query: any = { deletedAt: null, isActive: true };

    if (filters.search) {
      return this.cryptoRepository.searchCryptos(filters.search, page, limit);
    }

    return this.cryptoRepository.findWithPagination(query, page, limit);
  }

  /**
   * Get single crypto by ID
   */
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

  /**
   * Get networks for a specific crypto
   */
  async getCryptoNetworks(cryptoId: string) {
    const crypto = await this.getCryptoById(cryptoId);
    return crypto.networks || [];
  }

  /**
   * Validate and get network from crypto
   */
  private getNetwork(crypto: any, networkId: string) {
    const network = crypto.networks?.find(
      (n: any) => n.networkId === networkId
    );
    if (!network) {
      throw new AppError(
        "Invalid network selected",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    return network;
  }

  /**
   * Validate wallet address format
   */
  private validateWalletAddress(address: string, network: any) {
    if (!address || address.trim().length === 0) {
      throw new AppError(
        "Wallet address is required",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // If network has address pattern, validate against it
    if (network.addressPattern) {
      const regex = new RegExp(network.addressPattern);
      if (!regex.test(address)) {
        throw new AppError(
          `Invalid wallet address format for ${network.name}`,
          HTTP_STATUS.BAD_REQUEST,
          ERROR_CODES.VALIDATION_ERROR
        );
      }
    }

    return address.trim();
  }

  /**
   * Calculate breakdown for buy/sell transaction
   */
  async calculateBreakdown(data: {
    cryptoId: string;
    cryptoAmount: number;
    tradeType: "buy" | "sell";
    networkId: string;
  }) {
    const crypto = await this.getCryptoById(data.cryptoId);
    const network = this.getNetwork(crypto, data.networkId);

    // Get rate based on trade type
    const exchangeRate =
      data.tradeType === "buy" ? crypto.buyRate : crypto.sellRate;

    if (!exchangeRate || exchangeRate <= 0) {
      throw new AppError(
        `${data.tradeType === "buy" ? "Purchase" : "Sale"} rate not configured`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Calculate amounts
    const fiatAmount = data.cryptoAmount * exchangeRate;

    // Service fee (can be configurable - currently 0)
    const serviceFeePercentage = 0; // 0% - configure as needed
    const serviceFee = (fiatAmount * serviceFeePercentage) / 100;

    // Network fee from network config
    const networkFee = network.networkFee || 0;

    let totalAmount: number;
    if (data.tradeType === "buy") {
      // For BUY: user pays fiat + fees
      totalAmount = fiatAmount + serviceFee;
    } else {
      // For SELL: user receives fiat - fees
      totalAmount = fiatAmount - serviceFee;
    }

    return {
      crypto: {
        id: crypto._id,
        name: crypto.name,
        code: crypto.code,
        icon: crypto.icon,
      },
      network: {
        networkId: network.networkId,
        name: network.name,
        code: network.code,
      },
      cryptoAmount: data.cryptoAmount,
      fiatAmount,
      exchangeRate,
      serviceFee,
      networkFee,
      totalAmount,
      tradeType: data.tradeType,
    };
  }

  /**
   * BUY CRYPTO - User pays fiat, gets crypto
   */
  async buyCrypto(data: BuyCryptoData) {
    const reference = generateReference();

    // Get and validate crypto
    const crypto = await this.getCryptoById(data.cryptoId);

    if (!crypto.purchaseActivated) {
      throw new AppError(
        "Crypto purchase is currently disabled",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Get and validate network
    const network = this.getNetwork(crypto, data.networkId);

    if (!network.withdrawalEnabled) {
      throw new AppError(
        `Withdrawals are disabled for ${network.name}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate amount limits
    if (crypto.buyMinAmount && data.cryptoAmount < crypto.buyMinAmount) {
      throw new AppError(
        `Minimum purchase amount is ${crypto.buyMinAmount} ${crypto.code}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    if (crypto.buyMaxAmount && data.cryptoAmount > crypto.buyMaxAmount) {
      throw new AppError(
        `Maximum purchase amount is ${crypto.buyMaxAmount} ${crypto.code}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate wallet address
    const walletAddress = this.validateWalletAddress(
      data.walletAddress,
      network
    );

    // Get breakdown
    const breakdown = await this.calculateBreakdown({
      cryptoId: data.cryptoId,
      cryptoAmount: data.cryptoAmount,
      tradeType: "buy",
      networkId: data.networkId,
    });

    // Get user wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Check balance
    if (wallet.balance < breakdown.totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct from wallet
    await this.walletService.debitWallet(
      data.userId,
      breakdown.totalAmount,
      `Crypto purchase: ${breakdown.cryptoAmount} ${crypto.code}`,
      "main"
    );

    // Create crypto transaction with network snapshot
    const cryptoTransaction = await this.cryptoTransactionRepository.create({
      cryptoId: new Types.ObjectId(data.cryptoId),
      userId: new Types.ObjectId(data.userId),
      reference,
      tradeType: "buy",
      network: {
        networkId: network.networkId,
        code: network.code,
        name: network.name,
        contractAddress: network.contractAddress,
        confirmationsRequired: network.confirmationsRequired,
        explorerUrl: network.explorerUrl,
      },
      walletAddress,
      cryptoAmount: breakdown.cryptoAmount,
      fiatAmount: breakdown.fiatAmount,
      exchangeRate: breakdown.exchangeRate,
      serviceFee: breakdown.serviceFee,
      networkFee: breakdown.networkFee,
      totalAmount: breakdown.totalAmount,
      status: "pending",
    });

    // Create main transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "CryptoTransaction",
      transactableId: cryptoTransaction.id,
      reference,
      amount: breakdown.totalAmount,
      type: "crypto_purchase",
      provider: "internal",
      remark: `Buy ${breakdown.cryptoAmount} ${crypto.code} via ${network.name}`,
      purpose: "crypto_purchase",
      status: "pending",
      meta: {
        cryptoName: crypto.name,
        cryptoCode: crypto.code,
        network: network.name,
        walletAddress,
      },
    });

    // Update crypto transaction with transaction ID
    await this.cryptoTransactionRepository.update(cryptoTransaction.id, {
      transactionId: transaction.id.toString(),
    });

    // Send notification to admin
    await this.notificationRepository.create({
      type: "admin_crypto_buy_pending",
      notifiableType: "Admin",
      notifiableId: new Types.ObjectId(data.userId), // TODO: Use actual admin ID
      data: {
        reference,
        userName: "User", // Get from user object
        cryptoAmount: breakdown.cryptoAmount,
        cryptoCode: crypto.code,
        network: network.name,
        walletAddress,
        fiatAmount: breakdown.fiatAmount,
      },
    });

    // Send notification to user
    await this.notificationRepository.create({
      type: "transaction_pending",
      notifiableType: "User",
      notifiableId: new Types.ObjectId(data.userId),
      data: {
        transactionType: "Crypto Purchase",
        reference,
        cryptoAmount: breakdown.cryptoAmount,
        cryptoCode: crypto.code,
        amount: breakdown.totalAmount,
        status: "pending",
      },
    });

    return {
      ...cryptoTransaction.toObject(),
      crypto: {
        name: crypto.name,
        code: crypto.code,
        icon: crypto.icon,
      },
      breakdown,
    };
  }

  /**
   * SELL CRYPTO - User sends crypto, gets fiat
   */
  async sellCrypto(data: SellCryptoData) {
    const reference = generateReference();

    // Get and validate crypto
    const crypto = await this.getCryptoById(data.cryptoId);

    if (!crypto.saleActivated) {
      throw new AppError(
        "Crypto sale is currently disabled",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Get and validate network
    const network = this.getNetwork(crypto, data.networkId);

    if (!network.depositEnabled) {
      throw new AppError(
        `Deposits are disabled for ${network.name}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Validate platform deposit address is configured
    if (!network.platformDepositAddress) {
      throw new AppError(
        `Platform wallet not configured for ${network.name}`,
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        ERROR_CODES.NOT_IMPLEMENTED
      );
    }

    // Validate amount limits
    if (crypto.sellMinAmount && data.cryptoAmount < crypto.sellMinAmount) {
      throw new AppError(
        `Minimum sale amount is ${crypto.sellMinAmount} ${crypto.code}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    if (crypto.sellMaxAmount && data.cryptoAmount > crypto.sellMaxAmount) {
      throw new AppError(
        `Maximum sale amount is ${crypto.sellMaxAmount} ${crypto.code}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Get and validate bank account
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

    // Get breakdown
    const breakdown = await this.calculateBreakdown({
      cryptoId: data.cryptoId,
      cryptoAmount: data.cryptoAmount,
      tradeType: "sell",
      networkId: data.networkId,
    });

    // Create crypto transaction
    const cryptoTransaction = await this.cryptoTransactionRepository.create({
      cryptoId: new Types.ObjectId(data.cryptoId),
      userId: new Types.ObjectId(data.userId),
      reference,
      tradeType: "sell",
      network: {
        networkId: network.networkId,
        code: network.code,
        name: network.name,
        contractAddress: network.contractAddress,
        confirmationsRequired: network.confirmationsRequired,
        explorerUrl: network.explorerUrl,
      },
      walletAddress: network.platformDepositAddress,
      cryptoAmount: breakdown.cryptoAmount,
      fiatAmount: breakdown.fiatAmount,
      exchangeRate: breakdown.exchangeRate,
      serviceFee: breakdown.serviceFee,
      networkFee: breakdown.networkFee,
      totalAmount: breakdown.totalAmount,
      status: "pending",
      comment: data.comment,
      proof: data.proof,
      bankId: bankAccount.bankId,
      bankCode: bankAccount.bankCode,
      accountName: bankAccount.accountName,
      accountNumber: bankAccount.accountNumber,
    });

    // Send notification to admin for review
    await this.notificationRepository.create({
      type: "admin_crypto_sell_pending",
      notifiableType: "Admin",
      notifiableId: new Types.ObjectId(data.userId), // TODO: Use actual admin ID
      data: {
        reference,
        userName: "User",
        cryptoAmount: breakdown.cryptoAmount,
        cryptoCode: crypto.code,
        network: network.name,
        depositAddress: network.platformDepositAddress,
        fiatAmount: breakdown.fiatAmount,
        totalPayout: breakdown.totalAmount,
        bankDetails: {
          bankId: bankAccount.bankId,
          accountName: bankAccount.accountName,
          accountNumber: bankAccount.accountNumber,
        },
        proof: data.proof,
      },
    });

    // Send notification to user
    await this.notificationRepository.create({
      type: "transaction_pending",
      notifiableType: "User",
      notifiableId: new Types.ObjectId(data.userId),
      data: {
        transactionType: "Crypto Sale",
        reference,
        cryptoAmount: breakdown.cryptoAmount,
        cryptoCode: crypto.code,
        amount: breakdown.totalAmount,
        status: "pending",
        instructions: `Send exactly ${breakdown.cryptoAmount} ${crypto.code} to ${network.platformDepositAddress} on ${network.name} network`,
      },
    });

    return {
      ...cryptoTransaction.toObject(),
      crypto: {
        name: crypto.name,
        code: crypto.code,
        icon: crypto.icon,
      },
      breakdown,
      depositInstructions: {
        address: network.platformDepositAddress,
        network: network.name,
        amount: breakdown.cryptoAmount,
        confirmationsRequired: network.confirmationsRequired,
        explorerUrl: network.explorerUrl,
      },
    };
  }

  /**
   * Get user's crypto transactions with filters
   */
  async getCryptoTransactions(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = { userId: new Types.ObjectId(userId) };

    if (filters.tradeType) {
      query.tradeType = filters.tradeType;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.cryptoId) {
      query.cryptoId = new Types.ObjectId(filters.cryptoId);
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

    return this.cryptoTransactionRepository.findWithPagination(
      query,
      page,
      limit,
      { createdAt: -1 }
    );
  }

  /**
   * Get single transaction by ID
   */
  async getCryptoTransactionById(transactionId: string, userId?: string) {
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

    // If userId provided, verify ownership
    if (userId && transaction.userId.toString() !== userId) {
      throw new AppError(
        "Unauthorized access",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    return transaction;
  }

  /**
   * Get transaction by reference
   */
  async getCryptoTransactionByReference(reference: string, userId?: string) {
    const transaction = await this.cryptoTransactionRepository.findOne({
      reference,
    });

    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // If userId provided, verify ownership
    if (userId && transaction.userId.toString() !== userId) {
      throw new AppError(
        "Unauthorized access",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    return transaction;
  }

  /**
   * Get current crypto rates
   */
  async getCryptoRates() {
    const cryptos = await this.cryptoRepository.findWithPagination(
      { deletedAt: null, isActive: true },
      1,
      100
    );

    return cryptos.data.map((crypto: any) => ({
      id: crypto._id,
      name: crypto.name,
      code: crypto.code,
      symbol: crypto.symbol,
      icon: crypto.icon,
      buyRate: crypto.buyRate,
      sellRate: crypto.sellRate,
      saleActivated: crypto.saleActivated,
      purchaseActivated: crypto.purchaseActivated,
      networks: crypto.networks?.map((n: any) => ({
        networkId: n.networkId,
        name: n.name,
        code: n.code,
        depositEnabled: n.depositEnabled,
        withdrawalEnabled: n.withdrawalEnabled,
      })),
    }));
  }

  // ==================== ADMIN METHODS ====================

  /**
   * Update transaction status (Admin)
   */
  async updateTransactionStatus(
    transactionId: string,
    status: string,
    adminId: string,
    data?: {
      txHash?: string;
      reviewNote?: string;
      reviewProof?: string;
    }
  ) {
    const transaction = await this.getCryptoTransactionById(transactionId);

    const updateData: any = {
      status,
      reviewedBy: new Types.ObjectId(adminId),
      reviewedAt: new Date(),
    };

    if (data?.txHash) {
      updateData.txHash = data.txHash;
    }
    if (data?.reviewNote) {
      updateData.reviewNote = data.reviewNote;
    }
    if (data?.reviewProof) {
      updateData.reviewProof = data.reviewProof;
    }

    if (status === "processing") {
      updateData.processedAt = new Date();
    }
    if (status === "success") {
      updateData.completedAt = new Date();
    }

    // Handle refunds for failed/declined transactions
    if (
      (status === "failed" || status === "declined") &&
      transaction.tradeType === "buy" &&
      transaction.status === "pending"
    ) {
      // Refund user's wallet
      await this.walletService.creditWallet(
        transaction.userId.toString(),
        transaction.totalAmount,
        `Refund for ${status} crypto purchase`,
        "main"
      );
      updateData.status = "refunded";
    }

    const updated = await this.cryptoTransactionRepository.update(
      transactionId,
      updateData
    );

    // Send notification to user
    await this.notificationRepository.create({
      type: status === "success" ? "transaction_success" : "transaction_failed",
      notifiableType: "User",
      notifiableId: transaction.userId,
      data: {
        transactionType:
          transaction.tradeType === "buy" ? "Crypto Purchase" : "Crypto Sale",
        reference: transaction.reference,
        status,
        note: data?.reviewNote,
      },
    });

    return updated;
  }

  /**
   * Verify blockchain transaction (Admin/Automated)
   */
  async verifyBlockchainTransaction(
    transactionId: string,
    txHash: string,
    confirmations: number,
    blockNumber?: number
  ) {
    const transaction = await this.getCryptoTransactionById(transactionId);

    const updateData: any = {
      txHash,
      confirmations,
    };

    if (blockNumber) {
      updateData.blockNumber = blockNumber;
    }

    // Auto-approve if confirmations meet requirement
    if (confirmations >= transaction.network.confirmationsRequired) {
      updateData.status = "approved";
      updateData.processedAt = new Date();
    }

    return this.cryptoTransactionRepository.update(transactionId, updateData);
  }
}
