import { Transaction } from '@/models/wallet/Transaction';
import { User } from '@/models/core/User';
import { Deposit } from '@/models/banking/Deposit';
import { CryptoTransaction } from '@/models/crypto/CryptoTransaction';
import { GiftCardTransaction } from '@/models/giftcard/GiftCardTransaction';

export class ReportService {
  async getRevenueReport(startDate: Date, endDate: Date) {
    const transactions = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          totalRevenue: { $sum: '$amount' },
          totalServiceCharge: { $sum: '$serviceCharge' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 },
      },
    ]);

    const summary = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$amount' },
          totalServiceCharge: { $sum: '$serviceCharge' },
          totalTransactions: { $sum: 1 },
          avgTransactionValue: { $avg: '$amount' },
        },
      },
    ]);

    return {
      dailyBreakdown: transactions,
      summary: summary[0] || {
        totalRevenue: 0,
        totalServiceCharge: 0,
        totalTransactions: 0,
        avgTransactionValue: 0,
      },
    };
  }

  async getUserGrowthReport(startDate: Date, endDate: Date) {
    const userGrowth = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          newUsers: { $sum: 1 },
          verifiedUsers: {
            $sum: { $cond: [{ $eq: ['$emailVerified', true] }, 1, 0] },
          },
        },
      },
      {
        $sort: { '_id.year': -1, '_id.month': -1, '_id.day': -1 },
      },
    ]);

    const statusBreakdown = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
        },
      },
    ]);

    return {
      dailyGrowth: userGrowth,
      statusBreakdown,
    };
  }

  async getTransactionSummary(startDate: Date, endDate: Date) {
    const byType = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          successfulCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          failedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
          },
        },
      },
    ]);

    const byStatus = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    return {
      byType,
      byStatus,
    };
  }


  async getCryptoGiftCardReport(startDate: Date, endDate: Date) {
    const crypto = await CryptoTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    const giftCards = await GiftCardTransaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]);

    return {
      crypto,
      giftCards,
    };
  }

  async getTopUsers(startDate: Date, endDate: Date, limit: number = 10) {
    const topByVolume = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate, $lte: endDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: '$userId',
          totalVolume: { $sum: '$amount' },
          transactionCount: { $sum: 1 },
        },
      },
      {
        $sort: { totalVolume: -1 },
      },
      {
        $limit: limit,
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      {
        $unwind: '$user',
      },
      {
        $project: {
          userId: '$_id',
          userName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          email: '$user.email',
          totalVolume: 1,
          transactionCount: 1,
        },
      },
    ]);

    return topByVolume;
  }
}
