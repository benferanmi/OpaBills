import { UserRepository } from '@/repositories/UserRepository';
import { TransactionRepository } from '@/repositories/TransactionRepository';
import { WalletRepository } from '@/repositories/WalletRepository';

export class DashboardService {
  private userRepository: UserRepository;
  private transactionRepository: TransactionRepository;
  private walletRepository: WalletRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.transactionRepository = new TransactionRepository();
    this.walletRepository = new WalletRepository();
  }

  async getDashboardStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      todayUsers,
      activeUsers,
      totalTransactions,
      todayTransactions,
      successfulTransactions,
      failedTransactions,
      totalRevenue,
      todayRevenue,
    ] = await Promise.all([
      this.userRepository.count({}),
      this.userRepository.count({ createdAt: { $gte: today } }),
      this.userRepository.count({ status: 'active' }),
      this.transactionRepository.count({}),
      this.transactionRepository.count({ createdAt: { $gte: today } }),
      this.transactionRepository.count({ status: 'success' }),
      this.transactionRepository.count({ status: 'failed' }),
      this.calculateTotalRevenue(),
      this.calculateTodayRevenue(today),
    ]);

    return {
      users: {
        total: totalUsers,
        today: todayUsers,
        active: activeUsers,
      },
      transactions: {
        total: totalTransactions,
        today: todayTransactions,
        successful: successfulTransactions,
        failed: failedTransactions,
        successRate: totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0,
      },
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
      },
    };
  }

  private async calculateTotalRevenue() {
    const result = await this.transactionRepository.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  private async calculateTodayRevenue(today: Date) {
    const result = await this.transactionRepository.aggregate([
      { $match: { status: 'success', createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return result[0]?.total || 0;
  }

  async getRevenueChart(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const result = await this.transactionRepository.aggregate([
      {
        $match: {
          status: 'success',
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          revenue: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return result.map((item) => ({
      date: item._id,
      revenue: item.revenue,
      transactions: item.count,
    }));
  }

  async getTransactionTypeDistribution() {
    const result = await this.transactionRepository.aggregate([
      { $match: { status: 'success' } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          total: { $sum: '$amount' },
        },
      },
    ]);

    return result.map((item) => ({
      type: item._id,
      count: item.count,
      total: item.total,
    }));
  }
}
