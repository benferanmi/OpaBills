import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletService } from "./WalletService";
import { generateReference } from "@/utils/helpers";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";

export interface CreateTransactionDTO {
  userId: string;
  amount: number;
  type: string;
  provider: string;
  remark?: string;
  purpose?: string;
  meta?: any;
}

export class TransactionService {
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
  }

  async createTransaction(data: CreateTransactionDTO): Promise<any> {
    const reference = generateReference("TXN");

    const transaction = await this.transactionRepository.create({
      reference,
      amount: data.amount,
      type: data.type,
      provider: data.provider,
      remark: data.remark,
      purpose: data.purpose,
      status: "pending",
      meta: data.meta,
    });

    return {
      id: transaction._id,
      reference: transaction.reference,
      amount: transaction.amount,
      type: transaction.type,
      status: transaction.status,
      createdAt: transaction.createdAt,
    };
  }

  async getTransaction(reference: string): Promise<any> {
    const transaction = await this.transactionRepository.findByReference(
      reference
    );
    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    return transaction;
  }

  async getUserTransactions(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const query: any = { sourceId: userId };

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.provider) {
      query.provider = filters.provider;
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

    return this.transactionRepository.findWithFilters(query, page, limit);
  }

  async getRecentTransactions(
    userId: string,
    limit: number = 10
  ): Promise<any> {
    return this.transactionRepository.findWithFilters(
      { sourceId: userId },
      1,
      limit
    );
  }

  async getTransactionStats(userId: string): Promise<any> {
    const transactions = await this.transactionRepository.findWithFilters(
      { sourceId: userId, status: "success" },
      1,
      1000
    );

    const totalSpent = transactions.data.reduce(
      (sum: number, t: any) => sum + t.amount,
      0
    );
    const countByType = transactions.data.reduce((acc: any, t: any) => {
      acc[t.type] = (acc[t.type] || 0) + 1;
      return acc;
    }, {});

    return {
      totalSpent,
      totalCount: transactions.total,
      countByType,
      successRate: (transactions.total > 0
        ? (transactions.data.filter((t: any) => t.status === "success").length /
            transactions.total) *
          100
        : 0
      ).toFixed(2),
    };
  }

  async getTransactionTypes(): Promise<any> {
    return [
      "airtime",
      "data",
      "electricity",
      "tv_subscription",
      "betting",
      "e_pin",
      "internationalAirtime",
      "internationalData",
      "gift_card",
      "crypto",
      "flight",
      "wallet_transfer",
      "wallet_funding",
      "withdrawal",
    ];
  }

  async updateTransactionStatus(
    reference: string,
    status: "pending" | "success" | "failed" | "reversed"
  ): Promise<any> {
    const transaction = await this.transactionRepository.findByReference(
      reference
    );
    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const updated = await this.transactionRepository.updateStatus(
      transaction.id,
      status
    );
    return updated;
  }

  async getTransactionProviders(userId: string): Promise<any> {
    const transactions = await this.transactionRepository.findWithFilters(
      { sourceId: userId },
      1,
      1000
    );

    const providers = [
      ...new Set(transactions.data.map((t: any) => t.provider)),
    ];
    return providers;
  }

  async exportTransactions(userId: string, filters: any = {}): Promise<string> {
    const query: any = { sourceId: userId };

    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    const result = await this.transactionRepository.findWithFilters(
      query,
      1,
      10000
    );

    // Generate CSV
    const headers = [
      "Reference",
      "Type",
      "Provider",
      "Amount",
      "Status",
      "Date",
    ];
    const rows = result.data.map((t: any) => [
      t.reference,
      t.type,
      t.provider,
      t.amount,
      t.status,
      new Date(t.createdAt).toISOString(),
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row: any[]) => row.join(",")),
    ].join("\n");

    return csv;
  }

  async generateReceipt(reference: string): Promise<any> {
    const transaction = await this.transactionRepository.findByReference(
      reference
    );
    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    return {
      reference: transaction.reference,
      amount: transaction.amount,
      type: transaction.type,
      provider: transaction.provider,
      status: transaction.status,
      remark: transaction.remark,
      purpose: transaction.purpose,
      meta: transaction.meta,
      createdAt: transaction.createdAt,
      receiptNumber: `RCP-${transaction.reference}`,
    };
  }
}
