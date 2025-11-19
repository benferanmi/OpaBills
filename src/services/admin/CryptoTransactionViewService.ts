import {
  CryptoRepository,
  CryptoTransactionRepository,
} from "@/repositories/CryptoRepository";

export class CryptoTransactionViewService {
  private cryptoRepository: CryptoRepository;
  private cryptoTransactionRepository: CryptoTransactionRepository;

  constructor() {
    this.cryptoRepository = new CryptoRepository();
    this.cryptoTransactionRepository = new CryptoTransactionRepository();
  }

  async listCryptoTransactions(
    page: number = 1,
    limit: number = 20,
    filters: any = {}
  ) {
    const query: any = {};

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.cryptocurrency) {
      query.cryptocurrency = filters.cryptocurrency;
    }

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const result = await this.cryptoRepository.findWithPagination(
      query,
      page,
      limit
    );

    return {
      transactions: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async getCryptoTransactionDetails(transactionId: string) {
    const transaction = await this.cryptoRepository.findById(transactionId);
    if (!transaction) {
      throw new Error("Crypto transaction not found");
    }
    return transaction;
  }

  async getCryptoTransactionStats(filters: any = {}) {
    const query: any = {};

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const transactions = await this.cryptoTransactionRepository.find(query);

    const stats = {
      totalTransactions: transactions.length,
      totalVolume: transactions.reduce((sum, t) => sum + (t.cryptoAmount || 0), 0),
      byStatus: transactions.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: transactions.reduce((acc, t) => {
        acc[t.tradeType] = (acc[t.tradeType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return stats;
  }
}
