import { ReferralRepository } from '@/repositories/ReferralRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { WalletService } from './WalletService';
import { HTTP_STATUS, ERROR_CODES, CACHE_KEYS, CACHE_TTL } from '@/utils/constants';
import { ReferralTerms } from '@/models/system/ReferralTerms';
import { CacheService } from '../CacheService';

export class ReferralService {
  constructor(
    private referralRepository: ReferralRepository,
    private userRepository: UserRepository,
    private walletService: WalletService,
    private cacheService: CacheService
  ) {}

  async getReferralStats(userId: string) {
    const totalReferrals = await this.referralRepository.countByUserId(userId);
    const totalEarnings = await this.referralRepository.getTotalEarnings(userId);
    const paidEarnings = await this.referralRepository.getPaidEarnings(userId);
    const unpaidEarnings = await this.referralRepository.getUnpaidEarnings(userId);

    const referrals = await this.referralRepository.findByUserId(userId);

    return {
      totalReferrals,
      totalEarnings,
      paidEarnings,
      unpaidEarnings,
      referrals,
    };
  }

  async getReferredUsers(userId: string, page: number = 1, limit: number = 10) {
    const referrals = await this.referralRepository.findByUserId(userId);
    const userIds = referrals.map(r => r.refereeId.toString());
    
    const skip = (page - 1) * limit;
    const users = await this.userRepository.findMany(
      { _id: { $in: userIds } },
      skip,
      limit
    );

    return {
      data: users.map((u: any) => ({
        id: u._id,
        firstname: u.firstname,
        lastname: u.lastname,
        email: u.email,
        referredAt: referrals.find(r => r.refereeId.toString() === u._id.toString())?.createdAt,
      })),
      total: userIds.length,
    };
  }

  async getReferralEarnings(userId: string, page: number = 1, limit: number = 10) {
    const referrals = await this.referralRepository.findByUserId(userId);
    
    const skip = (page - 1) * limit;
    const earnings = referrals.slice(skip, skip + limit).map(r => ({
      id: r._id,
      refereeId: r.refereeId,
      amount: r.amount || 0,
      paid: r.paid,
      createdAt: r.createdAt,
    }));

    return {
      data: earnings,
      total: referrals.length,
    };
  }

  async getReferralTerms() {
    // Check cache first
    const cached = await this.cacheService.get(CACHE_KEYS.REFERRAL_TERMS);
    if (cached) {
      return cached;
    }

    const terms = await ReferralTerms.find().sort({ createdAt: -1 }).limit(1).exec();
    
    if (terms.length > 0) {
      await this.cacheService.set(CACHE_KEYS.REFERRAL_TERMS, terms[0], CACHE_TTL.ONE_HOUR);
      return terms[0];
    }

    return null;
  }

  async processReferralCommission(refereeId: string, transactionAmount: number) {
    // Check if this is the first qualifying transaction
    const referral = await this.referralRepository.findByRefereeId(refereeId);
    
    if (!referral || referral.paid) {
      return; // No referral or already paid
    }

    // Get commission threshold from settings
    const threshold = 100; // Can be fetched from Settings model

    if (transactionAmount < threshold) {
      return; // Transaction below threshold
    }

    // Get commission amount from settings
    const commissionAmount = 50; // Can be fetched from Settings model or calculated as percentage

    // Credit referee's commission wallet
    await this.walletService.creditWallet(
      referral.referredId.toString(),
      commissionAmount,
      `Referral commission for ${refereeId}`,
      'commission'
    );

    // Mark referral as paid
    await this.referralRepository.markAsPaid(referral.id.toString());
  }
}
