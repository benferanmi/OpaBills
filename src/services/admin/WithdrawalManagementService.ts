import { WithdrawalRepository } from '@/repositories/WithdrawalRepository';
import { WalletRepository } from '@/repositories/WalletRepository';
import { LedgerRepository } from '@/repositories/LedgerRepository';
import { NotificationService } from '../client/NotificationService';

export class WithdrawalManagementService {
  private withdrawalRepository: WithdrawalRepository;
  private walletRepository: WalletRepository;
  private ledgerRepository: LedgerRepository;
  private notificationService: NotificationService;

  constructor() {
    this.withdrawalRepository = new WithdrawalRepository();
    this.walletRepository = new WalletRepository();
    this.ledgerRepository = new LedgerRepository();
    this.notificationService = new NotificationService();
  }

  async listWithdrawals(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    if (filters.minAmount || filters.maxAmount) {
      query.amount = {};
      if (filters.minAmount) query.amount.$gte = parseFloat(filters.minAmount);
      if (filters.maxAmount) query.amount.$lte = parseFloat(filters.maxAmount);
    }

    const result = await this.withdrawalRepository.findWithPagination(query, page, limit);

    return {
      withdrawals: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async getWithdrawalDetails(withdrawalId: string) {
    const withdrawal = await this.withdrawalRepository.findById(withdrawalId);

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    return withdrawal;
  }

  async approveWithdrawal(withdrawalId: string, approvedBy: string) {
    const withdrawal = await this.withdrawalRepository.findById(withdrawalId);

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'pending') {
      throw new Error('Can only approve pending withdrawals');
    }

    // Update withdrawal status
    withdrawal.status = 'approved';
    withdrawal.approvedAt = new Date();
    withdrawal.approvedBy = approvedBy;
    await withdrawal.save();

    // Send notification
    // const wallet = await this.walletRepository.findById(withdrawal.walletId.toString());
    // if (wallet) {
    //   await this.notificationService.createNotification({
    //     notifiableId: wallet.userId,
    //     title: 'Withdrawal Approved',
    //     message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} has been approved and is being processed`,
    //     type: 'withdrawal',
    //   });
    // }

    return {
      message: 'Withdrawal approved successfully',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
      },
    };
  }

  async declineWithdrawal(withdrawalId: string, reason: string, declinedBy: string) {
    const withdrawal = await this.withdrawalRepository.findById(withdrawalId);

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'pending') {
      throw new Error('Can only decline pending withdrawals');
    }

    // const wallet = await this.walletRepository.findById(withdrawal.walletId.toString());

    // if (!wallet) {
    //   throw new Error('Wallet not found');
    // }

    // Refund the amount back to wallet
    // const previousBalance = wallet.balance;
    // wallet.balance += withdrawal.amount;
    // await wallet.save();

    // // Create ledger entry for refund
    // await this.ledgerRepository.create({
    //   ledgerableId: wallet.userId,
    //   ledgerableType: wallet.id,
    //   type: 'credit',
    //   amount: withdrawal.amount,
    //   oldBalance: previousBalance,
    //   newBalance: wallet.balance,
    //   // reference: `REFUND-${withdrawal.reference}`,
    //   reason: `Withdrawal declined: ${reason}`,
    // });

    // Update withdrawal status
    withdrawal.status = 'declined';
    withdrawal.declinedAt = new Date();
    withdrawal.declinedBy = declinedBy;
    withdrawal.declineReason = reason;
    await withdrawal.save();

    // Send notification
    // await this.notificationService.createNotification({
    //   userId: wallet.userId.toString(),
    //   title: 'Withdrawal Declined',
    //   message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} was declined and refunded. Reason: ${reason}`,
    //   type: 'withdrawal',
    // });

    return {
      message: 'Withdrawal declined and amount refunded',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
        reason,
      },
    };
  }

  async processWithdrawal(withdrawalId: string, provider: string, transactionId: string) {
    const withdrawal = await this.withdrawalRepository.findById(withdrawalId);

    if (!withdrawal) {
      throw new Error('Withdrawal not found');
    }

    if (withdrawal.status !== 'approved') {
      throw new Error('Can only process approved withdrawals');
    }

    withdrawal.status = 'approved';
    // withdrawal.processedAt = new Date();
    withdrawal.provider = provider;
    // withdrawal.providerReference = transactionId;
    await withdrawal.save();

    // Send notification
    // const wallet = await this.walletRepository.findById(withdrawal.walletId.toString());
    // if (wallet) {
      // await this.notificationService.createNotification({
      //   userId: wallet.userId.toString(),
      //   title: 'Withdrawal Completed',
      //   message: `Your withdrawal of ₦${withdrawal.amount.toLocaleString()} has been completed`,
      //   type: 'withdrawal',
      // });
    // }

    return {
      message: 'Withdrawal processed successfully',
      withdrawal: {
        id: withdrawal._id,
        amount: withdrawal.amount,
        status: withdrawal.status,
      },
    };
  }
}
