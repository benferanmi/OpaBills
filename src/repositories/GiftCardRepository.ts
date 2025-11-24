import { BaseRepository } from "./BaseRepository";
import { GiftCard, IGiftCard } from "@/models/giftcard/GiftCard";
import {
  GiftCardCategory,
  IGiftCardCategory,
} from "@/models/giftcard/GiftCardCategory";
import {
  GiftCardTransaction,
  IGiftCardTransaction,
} from "@/models/giftcard/GiftCardTransaction";
import { Types } from "mongoose";

export class GiftCardRepository extends BaseRepository<IGiftCard> {
  constructor() {
    super(GiftCard);
  }

  async findByProductId(productId: string): Promise<IGiftCard | null> {
    return this.model.findOne({ productId, status: "active" }).exec();
  }

  async findAll(filters: any = {}, page: number = 1, limit: number = 10) {
    return this.findWithPagination(filters, page, limit);
  }

  async findByCategory(
    categoryId: string | Types.ObjectId,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findWithPagination(
      { categoryId, status: "active" },
      page,
      limit
    );
  }

  async findByCountry(
    countryId: string | Types.ObjectId,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findWithPagination(
      { countryId, status: "active" },
      page,
      limit
    );
  }

  async searchGiftCards(query: string, page: number = 1, limit: number = 10) {
    const searchRegex = new RegExp(query, "i");
    return this.findWithPagination(
      { name: searchRegex, status: "active" },
      page,
      limit
    );
  }
}

export class GiftCardCategoryRepository extends BaseRepository<IGiftCardCategory> {
  constructor() {
    super(GiftCardCategory);
  }

  async findActive(
    page: number = 1,
    limit: number = 10,
    type?: "both" | "sell" | "buy"
  ) {
    return this.findWithPagination(
      { status: "active", transactionType: type },
      page,
      limit
    );
  }

  async findByCategoryId(
    categoryId: string
  ): Promise<IGiftCardCategory | null> {
    return this.model.findOne({ categoryId, status: "active" }).exec();
  }
}

export class GiftCardTransactionRepository extends BaseRepository<IGiftCardTransaction> {
  constructor() {
    super(GiftCardTransaction);
  }

  async findByReference(
    reference: string
  ): Promise<IGiftCardTransaction | null> {
    return this.model
      .findOne({ reference })
      .populate("giftCardId")
      .populate("userId", "firstname lastname email phone")
      .exec();
  }

  async findByReferenceWithoutPopulate(
    reference: string
  ): Promise<IGiftCardTransaction | null> {
    return this.model
      .findOne({ reference })

      .exec();
  }

  async findByUserId(
    userId: string | Types.ObjectId,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    return this.findWithPagination(
      { userId, ...filters },
      page,
      limit,
      { createdAt: -1 },
      [
        { path: "giftCardId", select: "name logo currency" },
        { path: "parentId", select: "reference groupTag status" },
      ]
    );
  }

  async findByGroupTag(groupTag: string): Promise<IGiftCardTransaction[]> {
    return this.model
      .find({ groupTag })
      .populate("giftCardId", "name logo currency")
      .populate("userId", "firstname lastname email phone")
      .sort({ createdAt: -1 })
      .exec();
  }

  // Find pending sell transactions for a specific user and gift card
  // Used to determine if we need to create/update parent transaction
  async findPendingSellByUserAndGiftCard(
    userId: string,
    giftCardId: string
  ): Promise<IGiftCardTransaction[]> {
    return this.model
      .find({
        userId: new Types.ObjectId(userId),
        giftCardId: new Types.ObjectId(giftCardId),
        tradeType: "sell",
        status: { $in: ["pending", "multiple"] },
      })
      .sort({ createdAt: -1 })
      .exec();
  }

  // Find all children of a parent transaction
  async findChildrenByParentId(
    parentId: string
  ): Promise<IGiftCardTransaction[]> {
    return this.model
      .find({ parentId: new Types.ObjectId(parentId) })
      .populate("giftCardId", "name logo currency")
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    transactionId: string,
    status:
      | "pending"
      | "processing"
      | "success"
      | "failed"
      | "approved"
      | "declined"
      | "multiple"
      | "s.approved",
    reviewData?: any
  ): Promise<IGiftCardTransaction | null> {
    return this.model
      .findByIdAndUpdate(
        transactionId,
        { status, ...reviewData },
        { new: true }
      )
      .exec();
  }

  async countPendingSellByUserAndGiftCard(
    userId: string,
    giftCardId: string
  ): Promise<number> {
    return this.model.countDocuments({
      userId: new Types.ObjectId(userId),
      giftCardId: new Types.ObjectId(giftCardId),
      tradeType: "sell",
      status: { $in: ["pending", "multiple"] },
    });
  }

  async findByGiftCardId(
    giftCardId: string | Types.ObjectId,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findWithPagination({ giftCardId }, page, limit);
  }

  async findByStatus(status: string, page: number = 1, limit: number = 10) {
    return this.findWithPagination({ status }, page, limit);
  }

  async findByTradeType(
    tradeType: "buy" | "sell",
    page: number = 1,
    limit: number = 10
  ) {
    return this.findWithPagination({ tradeType }, page, limit);
  }

  async findChildTransactions(parentId: string | Types.ObjectId) {
    return this.model.find({ parentId }).sort({ createdAt: -1 }).lean().exec();
  }

  async findWithFilters(
    query: any,
    page: number = 1,
    limit: number = 20
  ): Promise<{ data: any[]; total: number }> {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.model
        .find(query)
        .populate("giftCardId", "name category country")
        .populate("userId", "firstName lastName email")
        .populate("bankAccountId", "bankName accountName accountNumber")
        .populate("reviewedBy", "firstName lastName")
        .populate("secondApprovalBy", "firstName lastName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    return {
      data,
      total,
    };
  }
}

export class BankAccountRepository extends BaseRepository<any> {
  constructor() {
    // Assuming you have a BankAccount model
    super(require("@/models/BankAccount").BankAccount);
  }

  async findByUserId(userId: string): Promise<any[]> {
    return this.model.find({ userId: new Types.ObjectId(userId) }).exec();
  }
}
