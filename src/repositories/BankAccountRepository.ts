import { BaseRepository } from "./BaseRepository";
import { BankAccount, IBankAccount } from "@/models/reference/BankAccount";
import { Types } from "mongoose";

export class BankAccountRepository extends BaseRepository<IBankAccount> {
  constructor() {
    super(BankAccount);
  }

  async findByUserId(userId: string | Types.ObjectId): Promise<IBankAccount[]> {
    return this.model
      .find({ userId, deletedAt: null })
      .populate("bankId")
      .exec();
  }

  async findByIdAndPopulate(
    id: string | Types.ObjectId
  ): Promise<IBankAccount | null> {
    return this.model
      .findOne({ _id: id, deletedAt: null })
      .populate("bankId")
      .exec();
  }

  async findByAccountNumber(
    userId: string | Types.ObjectId,
    accountNumber: string
  ): Promise<IBankAccount | null> {
    return this.model
      .findOne({ userId, accountNumber, deletedAt: null })
      .exec();
  }
}
