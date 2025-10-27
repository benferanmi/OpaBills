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

  async getRecentActivity(userId: string, limit: number = 10): Promise<any> {
    const { data: transactions } = await this.transactionRepository.findByUserId(userId, 1, limit);
    return transactions;
  }

  async getQuickActions(userId: string): Promise<any> {
    return [
      { id: 'fund_wallet', name: 'Fund Wallet', icon: 'wallet', path: '/wallet/fund' },
      { id: 'buy_airtime', name: 'Buy Airtime', icon: 'phone', path: '/airtime' },
      { id: 'buy_data', name: 'Buy Data', icon: 'signal', path: '/data' },
      { id: 'pay_bills', name: 'Pay Bills', icon: 'bill', path: '/bills' },
      { id: 'transfer', name: 'Transfer', icon: 'send', path: '/transfer' },
      { id: 'withdraw', name: 'Withdraw', icon: 'money', path: '/withdraw' },
    ];
  }

  async getTransactionChartData(userId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.transactionRepository.findWithFilters({
      $or: [{ sourceId: userId }, { recipientId: userId }],
      status: 'success',
      createdAt: { $gte: startDate },
    })

    const chartData: any = {};
    transactions.data.forEach(tx => {
      const date = tx.createdAt.toISOString().split('T')[0];
      if (!chartData[date]) {
        chartData[date] = { date, income: 0, expense: 0 };
      }
      if (tx.recipientId?.toString() === userId) {
        chartData[date].income += tx.amount;
      } else {
        chartData[date].expense += tx.amount;
      }
    });

    return Object.values(chartData);
  }

  async getSpendingBreakdown(userId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const transactions = await this.transactionRepository.find({
      sourceId: userId,
      status: 'success',
      createdAt: { $gte: startDate },
    });

    const breakdown: any = {};
    transactions.forEach(tx => {
      const category = tx.type || 'other';
      if (!breakdown[category]) {
        breakdown[category] = { category, amount: 0, count: 0 };
      }
      breakdown[category].amount += tx.amount;
      breakdown[category].count += 1;
    });

    return Object.values(breakdown);
  }
}
