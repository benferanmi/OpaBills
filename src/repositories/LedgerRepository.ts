import { BaseRepository } from "./BaseRepository";
import { Ledger, ILedger } from "@/models/wallet/Ledger";
import { Types } from "mongoose";

interface CreateLedgerParams {
  userId: Types.ObjectId | string;
  walletId: Types.ObjectId | string;
  type: "debit" | "credit";
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference: string;
  description: string;
  meta?: any;
}

export class LedgerRepository extends BaseRepository<ILedger> {
  constructor() {
    super(Ledger);
  }

  async findByLedgerableId(
    ledgerableId: string | Types.ObjectId,
    page: number = 1,
    limit: number = 10
  ) {
    return this.findWithPagination({ ledgerableId }, page, limit);
  }

  async findByType(
    ledgerableId: string | Types.ObjectId,
    type: "debit" | "credit",
    page: number = 1,
    limit: number = 10
  ) {
    return this.findWithPagination({ ledgerableId, type }, page, limit);
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
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.model.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
    };
  }

  async createLedgerEntry(params: CreateLedgerParams): Promise<ILedger> {
    return this.create({
      ledgerableType: "Wallet",
      ledgerableId: params.walletId as Types.ObjectId,
      source:
        params.type === "debit" ? String(params.walletId) : params.reference,
      destination:
        params.type === "credit" ? String(params.walletId) : params.reference,
      oldBalance: params.balanceBefore,
      newBalance: params.balanceAfter,
      type: params.type,
      reason: params.description,
      amount: params.amount,
      currencyCode: "NGN",
    });
  }
}
