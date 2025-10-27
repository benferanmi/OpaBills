import { BaseRepository } from './BaseRepository';
import { Referral, IReferral } from '@/models/wallet/Referral';

export class ReferralRepository extends BaseRepository<IReferral> {
  constructor() {
    super(Referral);
  }

  async findByUserId(userId: string): Promise<IReferral[]> {
    return this.model.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  async findByRefereeId(refereeId: string): Promise<IReferral | null> {
    return this.model.findOne({ refereeId }).exec();
  }

  async countByUserId(userId: string): Promise<number> {
    return this.model.countDocuments({ userId }).exec();
  }

  async getTotalEarnings(userId: string): Promise<number> {
    const result = await this.model.aggregate([
      { $match: { userId } },
      { $group: { _id: null, total: { $sum: '$cumulativeAmount' } } },
    ]);
    
    return result.length > 0 ? result[0].total : 0;
  }

  async getPaidEarnings(userId: string): Promise<number> {
    const result = await this.model.aggregate([
      { $match: { userId, paid: true } },
      { $group: { _id: null, total: { $sum: '$cumulativeAmount' } } },
    ]);
    
    return result.length > 0 ? result[0].total : 0;
  }

  async getUnpaidEarnings(userId: string): Promise<number> {
    const result = await this.model.aggregate([
      { $match: { userId, paid: false } },
      { $group: { _id: null, total: { $sum: '$cumulativeAmount' } } },
    ]);
    
    return result.length > 0 ? result[0].total : 0;
  }

  async markAsPaid(referralId: string): Promise<IReferral | null> {
    return this.model.findByIdAndUpdate(
      referralId,
      { paid: true },
      { new: true }
    ).exec();
  }
}
