import {
  GiftCardRepository,
  GiftCardTransactionRepository,
} from "@/repositories/GiftCardRepository";
export class GiftCardTransactionViewService {
  private giftCardRepository: GiftCardRepository;
  private giftCardTransactionRepository: GiftCardTransactionRepository;

  constructor() {
    this.giftCardRepository = new GiftCardRepository();
    this.giftCardTransactionRepository = new GiftCardTransactionRepository();
  }

  async listGiftCardTransactions(
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

    if (filters.cardType) {
      query.cardType = filters.cardType;
    }

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const result = await this.giftCardRepository.findWithPagination(
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

  async getGiftCardTransactionDetails(transactionId: string) {
    const transaction = await this.giftCardRepository.findById(transactionId);
    if (!transaction) {
      throw new Error("Gift card transaction not found");
    }
    return transaction;
  }

  async getGiftCardTransactionStats(filters: any = {}) {
    const query: any = {};

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const transactions = await this.giftCardTransactionRepository.find(query);

    const stats = {
      totalTransactions: transactions.length,
      totalVolume: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      byStatus: transactions.reduce((acc, t) => {
        acc[t.status] = (acc[t.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCardType: transactions.reduce((acc, t) => {
        // Provide a default value if cardType is undefined
        const type = t.cardType ?? "unknown";
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return stats;
  }
}
