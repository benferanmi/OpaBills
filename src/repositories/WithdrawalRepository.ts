import { BaseRepository } from './BaseRepository';
import { WithdrawalRequest, IWithdrawalRequest } from '@/models/banking/WithdrawalRequest';

export class WithdrawalRepository extends BaseRepository<IWithdrawalRequest> {
  constructor() {
    super(WithdrawalRequest);
  }

  async findByReference(reference: string): Promise<IWithdrawalRequest | null> {
    return this.model.findOne({ reference }).exec();
  }

  async findByUserId(userId: string, filters: any = {}, page: number = 1, limit: number = 10) {
    const query: any = { userId, ...filters };
    return this.findWithPagination(query, page, limit, { createdAt: -1 });
  }

  async updateStatus(requestId: string, status: string): Promise<IWithdrawalRequest | null> {
    return this.model.findByIdAndUpdate(
      requestId,
      { status },
      { new: true }
    ).exec();
  }
}
