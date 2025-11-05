import { DepositRepository } from '@/repositories/DepositRepository';
import { WalletRepository } from '@/repositories/WalletRepository';
import { LedgerRepository } from '@/repositories/LedgerRepository';
import { NotificationService } from '@/services/client/NotificationService';

export class DepositManagementService {
  private depositRepository: DepositRepository;
  private walletRepository: WalletRepository;
  private ledgerRepository: LedgerRepository;
  private notificationService: NotificationService;

  constructor() {
    this.depositRepository = new DepositRepository();
    this.walletRepository = new WalletRepository();
    this.ledgerRepository = new LedgerRepository();
    this.notificationService = new NotificationService();
  }

  async listDeposits(page: number = 1, limit: number = 20, filters: any = {}) {
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

    const result = await this.depositRepository.findWithPagination(query, page, limit);

    return {
      deposits: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async getDepositDetails(depositId: string) {
    const deposit = await this.depositRepository.findById(depositId);

    if (!deposit) {
      throw new Error('Deposit not found');
    }

    return deposit;
  }

  // async approveDeposit(depositId: string, approvedBy: string) {
  //   const deposit = await this.depositRepository.findById(depositId);

  //   if (!deposit) {
  //     throw new Error('Deposit not found');
  //   }

  //   if (deposit.status !== 'pending') {
  //     throw new Error('Can only approve pending deposits');
  //   }

  //   const wallet = await this.walletRepository.findById(deposit.walletId.toString());

  //   if (!wallet) {
  //     throw new Error('Wallet not found');
  //   }

  //   // Credit wallet
  //   const previousBalance = wallet.mainBalance;
  //   wallet.mainBalance += deposit.amount;
  //   await wallet.save();

  //   // Create ledger entry
  //   await this.ledgerRepository.create({
  //     userId: wallet.userId,
  //     walletId: wallet._id,
  //     type: 'credit',
  //     amount: deposit.amount,
  //     balanceBefore: previousBalance,
  //     balanceAfter: wallet.mainBalance,
  //     reference: deposit.reference,
  //     description: 'Deposit approved',
  //   });

  //   // Update deposit status
  //   deposit.status = 'approved';
  //   deposit.approvedAt = new Date();
  //   deposit.approvedBy = approvedBy;
  //   await deposit.save();

  //   // Send notification
  //   await this.notificationService.createNotification({
  //     userId: wallet.userId.toString(),
  //     title: 'Deposit Approved',
  //     message: `Your deposit of ₦${deposit.amount.toLocaleString()} has been approved`,
  //     type: 'deposit',
  //   });

  //   return {
  //     message: 'Deposit approved successfully',
  //     deposit: {
  //       id: deposit._id,
  //       amount: deposit.amount,
  //       status: deposit.status,
  //     },
  //   };
  // }

  // async declineDeposit(depositId: string, reason: string, declinedBy: string) {
  //   const deposit = await this.depositRepository.findById(depositId);

  //   if (!deposit) {
  //     throw new Error('Deposit not found');
  //   }

  //   if (deposit.status !== 'pending') {
  //     throw new Error('Can only decline pending deposits');
  //   }

  //   deposit.status = 'declined';
  //   deposit.declinedAt = new Date();
  //   deposit.declinedBy = declinedBy;
  //   deposit.declineReason = reason;
  //   await deposit.save();

  //   // Send notification
  //   const wallet = await this.walletRepository.findById(deposit.walletId.toString());
  //   if (wallet) {
  //     await this.notificationService.createNotification({
  //       userId: wallet.userId.toString(),
  //       title: 'Deposit Declined',
  //       message: `Your deposit of ₦${deposit.amount.toLocaleString()} was declined. Reason: ${reason}`,
  //       type: 'deposit',
  //     });
  //   }

  //   return {
  //     message: 'Deposit declined successfully',
  //     deposit: {
  //       id: deposit._id,
  //       amount: deposit.amount,
  //       status: deposit.status,
  //       reason,
  //     },
  //   };
  // }
}
