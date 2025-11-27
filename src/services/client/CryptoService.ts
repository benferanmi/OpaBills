import {
  CryptoRepository,
  CryptoTransactionRepository,
} from "@/repositories/CryptoRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { WalletService } from "./WalletService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { generateReference } from "@/utils/helpers";
import { NotificationService } from "./NotificationService";

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
  proof?: string; // Screenshot/txHash proof
  bankAccountId: string;
}

export class CryptoService {
  private cryptoRepository: CryptoRepository;
  private cryptoTransactionRepository: CryptoTransactionRepository;
  private transactionRepository: TransactionRepository;
  private bankAccountRepository: BankAccountRepository;
  private walletService: WalletService;
  private notificationService: NotificationService;

  constructor() {
    this.cryptoRepository = new CryptoRepository();
    this.cryptoTransactionRepository = new CryptoTransactionRepository();
    this.transactionRepository = new TransactionRepository();
    this.bankAccountRepository = new BankAccountRepository();
    this.walletService = new WalletService();
    this.notificationService = new NotificationService();
  }

  // Get list of available cryptos with filters
  async getCryptos(filters: any = {}, page: number = 1, limit: number = 10) {
    const query: any = { deletedAt: null, isActive: true };

    if (filters.search) {
      return this.cryptoRepository.searchCryptos(filters.search, page, limit);
    }

    return this.cryptoRepository.findWithPagination(query, page, limit);
  }

  // Get single crypto by ID
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

  // Get networks for a specific crypto
  async getCryptoNetworks(cryptoId: string) {
    const crypto = await this.getCryptoById(cryptoId);
    return (
      crypto.networks.map((n: any) => ({
        networkId: n.networkId,
        name: n.name,
        code: n.code,
        platformDepositAddress: n.platformDepositAddress,
        depositEnabled: n.depositEnabled,
        withdrawalEnabled: n.withdrawalEnabled,
      })) || []
    );
  }

  // Validate and get network from crypto
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

  // Validate wallet address format
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

  // Calculate breakdown for buy/sell transaction
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

  // BUY CRYPTO - User pays fiat, gets crypto
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

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      breakdown.totalAmount,
      `Crypto purchase: ${breakdown.cryptoAmount} ${crypto.code}`,
      "main",
      {
        type: "crypto_purchase",
        provider: "internal",
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        meta: {
          cryptoName: crypto.name,
          cryptoCode: crypto.code,
          network: network.name,
          walletAddress,
        },
      }
    );

    const transaction = debitResult.transaction;

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
      transactionId: transaction.id.toString(),
    });

    // Update transaction with crypto transaction link
    await this.transactionRepository.update(transaction.id, {
      transactableType: "CryptoTransaction",
      transactableId: cryptoTransaction.id,
    });

    // Send notification to admin
    await this.notificationService.createNotification({
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
      sendEmail: true,
      sendSMS: false,
      sendPush: false,
    });

    // Send notification to user
    await this.notificationService.createNotification({
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
      sendEmail: true,
      sendSMS: false,
      sendPush: true,
    });

    return {
      ...this.sanitizeCryptoTransaction(cryptoTransaction),
      crypto: {
        name: crypto.name,
        code: crypto.code,
        icon: crypto.icon,
      },
      breakdown,
    };
  }

  // SELL CRYPTO - User sends crypto, gets fiat
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

    // Create crypto transaction (no wallet debit for sell - user gets credited after verification)
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
      proof: data.proof || "",
      bankId: bankAccount.bankId,
      bankCode: bankAccount.bankCode,
      accountName: bankAccount.accountName,
      accountNumber: bankAccount.accountNumber,
    });

    // Send notification to admin for review
    await this.notificationService.createNotification({
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
        proof: data.proof || "",
      },
      sendEmail: true,
      sendSMS: false,
      sendPush: false,
    });

    // Send notification to user
    await this.notificationService.createNotification({
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
      sendEmail: true,
      sendSMS: false,
      sendPush: true,
    });

    return {
      ...this.sanitizeCryptoTransaction(cryptoTransaction),
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

  // Get user's crypto transactions with filters
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

    if (filters.reference) {
      query.reference = filters.reference;
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

  // Get single transaction by ID
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

  // Get transaction by reference
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

  // Get current crypto rates
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
      // saleActivated: crypto.saleActivated,
      // purchaseActivated: crypto.purchaseActivated,
      // networks: crypto.networks?.map((n: any) => ({
      //   networkId: n.networkId,
      //   name: n.name,
      //   code: n.code,
      //   depositEnabled: n.depositEnabled,
      //   withdrawalEnabled: n.withdrawalEnabled,
      // })),
    }));
  }
  // Export crypto transactions to CSV
  async exportCryptoTransactions(
    userId: string,
    filters: any = {}
  ): Promise<string> {
    const query: any = { userId: new Types.ObjectId(userId) };

    // Apply same filters as getCryptoTransactions
    if (filters.tradeType) query.tradeType = filters.tradeType;
    if (filters.status) query.status = filters.status;
    if (filters.cryptoId) query.cryptoId = new Types.ObjectId(filters.cryptoId);
    if (filters.networkCode) query["network.code"] = filters.networkCode;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const result = await this.cryptoTransactionRepository.findWithPagination(
      query,
      1,
      10000,
      { createdAt: -1 }
    );

    // Generate CSV
    const headers = [
      "Reference",
      "Trade Type",
      "Crypto",
      "Network",
      "Crypto Amount",
      "Fiat Amount",
      "Exchange Rate",
      "Service Fee",
      "Network Fee",
      "Total Amount",
      "Status",
      "Wallet Address",
      "TX Hash",
      "Confirmations",
      "Bank Account",
      "Review Note",
      "Date",
    ];

    const rows = result.data.map((t: any) => [
      t.reference,
      t.tradeType,
      t.cryptoId?.name || t.cryptoId || "",
      t.network?.name || "",
      t.cryptoAmount,
      t.fiatAmount,
      t.exchangeRate,
      t.serviceFee || 0,
      t.networkFee || 0,
      t.totalAmount,
      t.status,
      t.walletAddress,
      t.txHash || "",
      t.confirmations || 0,
      t.accountNumber || "",
      t.reviewNote || "",
      new Date(t.createdAt).toISOString(),
    ]);

    const escapeCsvValue = (value: any): string => {
      const strValue = String(value);
      if (
        strValue.includes(",") ||
        strValue.includes('"') ||
        strValue.includes("\n")
      ) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    };

    const csv = [
      headers.join(","),
      ...rows.map((row: any[]) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    return csv;
  }

  // Generate receipt for crypto transaction
  async generateCryptoReceipt(reference: string, userId: string): Promise<any> {
    const transaction = await this.getCryptoTransactionByReference(
      reference,
      userId
    );

    // Only generate receipts for successful or approved transactions
    if (!["success", "approved"].includes(transaction.status)) {
      throw new AppError(
        "Receipt can only be generated for successful or approved transactions",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.BAD_REQUEST
      );
    }

    return {
      receiptNumber: `CRYPTO-RCP-${transaction.reference}`,
      reference: transaction.reference,
      tradeType: transaction.tradeType,
      crypto: transaction.cryptoId,
      network: transaction.network,
      walletAddress: transaction.walletAddress,
      cryptoAmount: transaction.cryptoAmount,
      fiatAmount: transaction.fiatAmount,
      exchangeRate: transaction.exchangeRate,
      serviceFee: transaction.serviceFee,
      networkFee: transaction.networkFee,
      totalAmount: transaction.totalAmount,
      status: transaction.status,
      txHash: transaction.txHash,
      confirmations: transaction.confirmations,
      blockNumber: transaction.blockNumber,
      bankDetails: transaction.accountNumber
        ? {
            accountName: transaction.accountName,
            accountNumber: transaction.accountNumber,
            bankCode: transaction.bankCode,
          }
        : null,
      reviewNote: transaction.reviewNote,
      transactionDate: transaction.createdAt,
      completedDate: transaction.completedAt,
      generatedAt: new Date(),
    };
  }

  // Upload transaction proof (for sell transactions)
  async uploadTransactionProof(
    reference: string,
    userId: string,
    proof: string
  ): Promise<any> {
    const transaction = await this.getCryptoTransactionByReference(
      reference,
      userId
    );

    if (transaction.tradeType !== "sell") {
      throw new AppError(
        "Proof can only be uploaded for sell transactions",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (!["pending", "processing"].includes(transaction.status)) {
      throw new AppError(
        "Cannot upload proof for completed transactions",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const updated = await this.cryptoTransactionRepository.update(
      transaction.id.toString(),
      { proof }
    );

    // Notify admin about proof upload
    await this.notificationService.createNotification({
      type: "admin_crypto_proof_uploaded",
      notifiableType: "Admin",
      notifiableId: transaction.userId, // TODO: Use actual admin ID
      data: {
        reference: transaction.reference,
        cryptoAmount: transaction.cryptoAmount,
        cryptoCode: transaction.cryptoId,
        proof,
      },
      sendEmail: true,
      sendSMS: false,
      sendPush: false,
    });

    return updated;
  }
  private sanitizeCryptoTransaction(transaction: any) {
    return {
      id: transaction._id || transaction.id,
      reference: transaction.reference,
      tradeType: transaction.tradeType,

      // Network info
      network: transaction.network,
      walletAddress: transaction.walletAddress,

      // Amounts
      cryptoAmount: transaction.cryptoAmount,
      fiatAmount: transaction.fiatAmount,
      exchangeRate: transaction.exchangeRate,
      serviceFee: transaction.serviceFee,
      networkFee: transaction.networkFee,
      totalAmount: transaction.totalAmount,

      // Status
      status: transaction.status,

      // Blockchain details (if available)
      txHash: transaction.txHash,
      confirmations: transaction.confirmations,
      blockNumber: transaction.blockNumber,

      // User-facing fields
      comment: transaction.comment,
      proof: transaction.proof,
      reviewNote: transaction.reviewNote,

      // Bank details for SELL (if exists)
      ...(transaction.accountNumber && {
        bankDetails: {
          accountName: transaction.accountName,
          accountNumber: transaction.accountNumber,
          bankCode: transaction.bankCode,
        },
      }),

      // Timestamps
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      processedAt: transaction.processedAt,
      completedAt: transaction.completedAt,
    };
  }
}
