import { BaseRepository } from "./BaseRepository";
import {
  CryptoTransaction,
  ICryptoTransaction,
} from "@/models/crypto/CryptoTransaction";
import { Types, PipelineStage } from "mongoose";

export class CryptoTransactionRepository extends BaseRepository<ICryptoTransaction> {
  constructor() {
    super(CryptoTransaction);
  }

  async findByUserId(
    userId: string | Types.ObjectId
  ): Promise<ICryptoTransaction[]> {
    return this.model.find({ userId }).exec();
  }

  async findByReference(reference: string): Promise<ICryptoTransaction | null> {
    return this.model.findOne({ reference }).exec();
  }

  async findByTransactionId(
    transactionId: string
  ): Promise<ICryptoTransaction | null> {
    return this.model.findOne({ transactionId }).exec();
  }

  async findByStatus(
    status: ICryptoTransaction["status"]
  ): Promise<ICryptoTransaction[]> {
    return this.model.find({ status }).exec();
  }

  async findByTradeType(
    tradeType: "buy" | "sell"
  ): Promise<ICryptoTransaction[]> {
    return this.model.find({ tradeType }).exec();
  }

  async findByCryptoId(
    cryptoId: string | Types.ObjectId
  ): Promise<ICryptoTransaction[]> {
    return this.model.find({ cryptoId }).exec();
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<ICryptoTransaction[]> {
    return this.model
      .find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .exec();
  }

  async findPendingTransactions(): Promise<ICryptoTransaction[]> {
    return this.model.find({ status: "pending" }).exec();
  }

  async findApprovedTransactions(): Promise<ICryptoTransaction[]> {
    return this.model.find({ status: "approved" }).exec();
  }

  async updateStatus(
    transactionId: string,
    status: ICryptoTransaction["status"]
  ): Promise<ICryptoTransaction | null> {
    return this.model
      .findByIdAndUpdate(transactionId, { status }, { new: true })
      .exec();
  }

  async updateReview(
    transactionId: string,
    reviewData: {
      reviewNote?: string;
      reviewRate?: number;
      reviewAmount?: number;
      reviewProof?: string;
    }
  ): Promise<ICryptoTransaction | null> {
    return this.model
      .findByIdAndUpdate(transactionId, reviewData, { new: true })
      .exec();
  }

  async findWithFilters(filters: {
    userId?: string | Types.ObjectId;
    status?: ICryptoTransaction["status"];
    tradeType?: "buy" | "sell";
    startDate?: Date;
    endDate?: Date;
    cryptoId?: string | Types.ObjectId;
  }): Promise<ICryptoTransaction[]> {
    const query: any = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.status) query.status = filters.status;
    if (filters.tradeType) query.tradeType = filters.tradeType;
    if (filters.cryptoId) query.cryptoId = filters.cryptoId;

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: filters.startDate,
        $lte: filters.endDate,
      };
    }

    return this.model.find(query).exec();
  }

  async getTotalVolume(filters: any = {}): Promise<number> {
    const transactions = await this.model.find(filters).exec();
    return transactions.reduce((sum, t) => sum + (t.amount || 0), 0);
  }

  async getTransactionStats(filters: any = {}): Promise<{
    totalTransactions: number;
    totalVolume: number;
    averageAmount: number;
    byStatus: Record<string, number>;
    byTradeType: Record<string, number>;
    byCryptocurrency: Record<string, number>;
  }> {
    const transactions = await this.model.find(filters).exec();

    const totalTransactions = transactions.length;
    const totalVolume = transactions.reduce(
      (sum, t) => sum + (t.amount || 0),
      0
    );
    const averageAmount =
      totalTransactions > 0 ? totalVolume / totalTransactions : 0;

    const byStatus = transactions.reduce((acc, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byTradeType = transactions.reduce((acc, t) => {
      acc[t.tradeType] = (acc[t.tradeType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byCryptocurrency = transactions.reduce((acc, t) => {
      const cryptoId = t.cryptoId.toString();
      acc[cryptoId] = (acc[cryptoId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalTransactions,
      totalVolume,
      averageAmount,
      byStatus,
      byTradeType,
      byCryptocurrency,
    };
  }

  // Add aggregate method for advanced queries
  async aggregate<T = any>(pipeline: PipelineStage[]): Promise<T[]> {
    return this.model.aggregate<T>(pipeline).exec();
  }

  // Get transactions with pagination
  async findWithPagination(
    query: any = {},
    page: number = 1,
    limit: number = 20
  ): Promise<{
    data: any[];
    total: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("userId", "name email")
        .populate("cryptoId", "name symbol")
        .lean()
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      totalPages,
    };
  }

  // Get crypto transaction volume by cryptocurrency
  async getVolumeByMeta(metaField: string): Promise<
    Array<{
      cryptocurrency: string;
      volume: number;
      count: number;
    }>
  > {
    const result = await this.aggregate([
      { $match: { status: "success" } },
      {
        $group: {
          _id: `$${metaField}`,
          volume: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { volume: -1 } },
    ]);

    return result.map((item) => ({
      cryptocurrency: item._id || "Unknown",
      volume: item.volume,
      count: item.count,
    }));
  }
}
