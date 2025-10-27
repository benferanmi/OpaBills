import { BaseRepository } from "./BaseRepository";
import { Wallet, IWallet } from "@/models/wallet/Wallet";
import { Types } from "mongoose";

export class WalletRepository extends BaseRepository<IWallet> {
  constructor() {
    super(Wallet);
  }

  async findByUserId(
    userId: string | Types.ObjectId,
    type: "main" | "bonus" | "commission" = "main"
  ): Promise<IWallet | null> {
    return this.model.findOne({ userId, type }).exec();
  }

  async findAllByUserId(userId: string | Types.ObjectId): Promise<IWallet[]> {
    return this.model.find({ userId }).exec();
  }

  async updateBalance(
    walletId: string,
    newBalance: number
  ): Promise<IWallet | null> {
    return this.model
      .findByIdAndUpdate(walletId, { balance: newBalance }, { new: true })
      .exec();
  }

  async incrementBalance(
    walletId: string,
    amount: number
  ): Promise<IWallet | null> {
    return this.model
      .findByIdAndUpdate(walletId, { $inc: { balance: amount } }, { new: true })
      .exec();
  }

  async decrementBalance(
    walletId: string,
    amount: number
  ): Promise<IWallet | null> {
    return this.model
      .findByIdAndUpdate(
        walletId,
        { $inc: { balance: -amount } },
        { new: true }
      )
      .exec();
  }
}
