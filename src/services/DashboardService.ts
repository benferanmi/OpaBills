import { UserRepository } from '@/repositories/UserRepository';
import { WalletRepository } from '@/repositories/WalletRepository';
import { TransactionRepository } from '@/repositories/TransactionRepository';
import { NotificationRepository } from '@/repositories/NotificationRepository';

export class DashboardService {
  constructor(
    private userRepository: UserRepository,
    private walletRepository: WalletRepository,
    private transactionRepository: TransactionRepository,
    private notificationRepository: NotificationRepository
  ) {}

  async getDashboardStats(userId: string): Promise<any> {
    // Get all wallets
    const wallets = await this.walletRepository.findAllByUserId(userId);

    // Get recent transactions
    const { data: recentTransactions } = await this.transactionRepository.findByUserId(userId, 1, 5);

    // Get unread notifications count
    const unreadNotifications = await this.notificationRepository.countUnread(userId);

    // Calculate total balance
    const totalBalance = wallets.reduce((sum, wallet) => sum + wallet.balance, 0);

    // Get successful transactions count
    const successfulTransactions = await this.transactionRepository.count({
      $or: [{ sourceId: userId }, { recipientId: userId }],
      status: 'success',
    });

    return {
      wallets: wallets.map(w => ({
        type: w.type,
        balance: w.balance,
      })),
      totalBalance,
      recentTransactions,
      unreadNotifications,
      successfulTransactions,
    };
  }
}
