import { BaseRepository } from "./BaseRepository";
import {
  GiftCardTransaction,
  IGiftCardTransaction,
} from "@/models/giftcard/GiftCardTransaction";
import { Types } from "mongoose";

export class GiftCardTransactionRepository extends BaseRepository<IGiftCardTransaction> {
  constructor() {
    super(GiftCardTransaction);
  }

  async findByUserId(
    userId: string | Types.ObjectId
  ): Promise<IGiftCardTransaction[]> {
    return this.model.find({ userId }).exec();
  }

  async findByReference(
    reference: string
  ): Promise<IGiftCardTransaction | null> {
    return this.model.findOne({ reference }).exec();
  }

  async findByStatus(
    status: IGiftCardTransaction["status"]
  ): Promise<IGiftCardTransaction[]> {
    return this.model.find({ status }).exec();
  }

  async findByTradeType(
    tradeType: "buy" | "sell"
  ): Promise<IGiftCardTransaction[]> {
    return this.model.find({ tradeType }).exec();
  }

  async findByGiftCardId(
    giftCardId: string | Types.ObjectId
  ): Promise<IGiftCardTransaction[]> {
    return this.model.find({ giftCardId }).exec();
  }

  async findByGroupTag(groupTag: string): Promise<IGiftCardTransaction[]> {
    return this.model.find({ groupTag }).exec();
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date
  ): Promise<IGiftCardTransaction[]> {
    return this.model
      .find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
      })
      .exec();
  }

  async findPendingTransactions(): Promise<IGiftCardTransaction[]> {
    return this.model.find({ status: "pending" }).exec();
  }

  async findPreorders(): Promise<IGiftCardTransaction[]> {
    return this.model.find({ preorder: true }).exec();
  }

  async updateStatus(
    transactionId: string,
    status: IGiftCardTransaction["status"]
  ): Promise<IGiftCardTransaction | null> {
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
  ): Promise<IGiftCardTransaction | null> {
    return this.model
      .findByIdAndUpdate(transactionId, reviewData, { new: true })
      .exec();
  }

  async findWithFilters(filters: {
    userId?: string | Types.ObjectId;
    status?: IGiftCardTransaction["status"];
    tradeType?: "buy" | "sell";
    startDate?: Date;
    endDate?: Date;
    giftCardId?: string | Types.ObjectId;
    preorder?: boolean;
  }): Promise<IGiftCardTransaction[]> {
    const query: any = {};

    if (filters.userId) query.userId = filters.userId;
    if (filters.status) query.status = filters.status;
    if (filters.tradeType) query.tradeType = filters.tradeType;
    if (filters.giftCardId) query.giftCardId = filters.giftCardId;
    if (filters.preorder !== undefined) query.preorder = filters.preorder;

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

    return {
      totalTransactions,
      totalVolume,
      averageAmount,
      byStatus,
      byTradeType,
    };
  }
}
