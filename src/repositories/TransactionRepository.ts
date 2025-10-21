import { BaseRepository } from './BaseRepository';
import { Transaction, ITransaction } from '@/models/wallet/Transaction';
import { Types } from 'mongoose';

export class TransactionRepository extends BaseRepository<ITransaction> {
  constructor() {
    super(Transaction);
  }

  async findByReference(reference: string): Promise<ITransaction | null> {
    return this.model.findOne({ reference }).exec();
  }

  async findByWalletId(walletId: string | Types.ObjectId, page: number = 1, limit: number = 10) {
    return this.findWithPagination({ walletId }, page, limit);
  }

  async findByUserId(userId: string | Types.ObjectId, page: number = 1, limit: number = 10) {
    return this.findWithPagination(
      { $or: [{ sourceId: userId }, { recipientId: userId }] },
      page,
      limit
    );
  }

  async findByStatus(status: string, page: number = 1, limit: number = 10) {
    return this.findWithPagination({ status }, page, limit);
  }

  async findByType(type: string, page: number = 1, limit: number = 10) {
    return this.findWithPagination({ type }, page, limit);
  }

  async updateStatus(transactionId: string, status: 'pending' | 'success' | 'failed' | 'reversed'): Promise<ITransaction | null> {
    return this.model.findByIdAndUpdate(
      transactionId,
      { status },
      { new: true }
    ).exec();
  }
}
