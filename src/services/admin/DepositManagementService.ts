import { DepositRequestRepository } from "@/repositories/DepositRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletRepository } from "@/repositories/WalletRepository";
import { NotificationService } from "@/services/client/NotificationService";
import { Types } from "mongoose";

export class DepositManagementService {
  private depositRequestRepository: DepositRequestRepository;
  private walletRepository: WalletRepository;
  private notificationService: NotificationService;
  private transactionRepository: TransactionRepository;

  constructor() {
    this.depositRequestRepository = new DepositRequestRepository();
    this.walletRepository = new WalletRepository();
    this.notificationService = new NotificationService();
    this.transactionRepository = new TransactionRepository();
  }

  async listDeposits(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.userId) {
      query.userId = filters.userId;
    }

    if (filters.provider) {
      query.provider = filters.provider;
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

    const populate = [
      { path: "userId", select: "firstName lastName email phone" },
    ];

    const result = await this.depositRequestRepository.findWithPagination(
      query,
      page,
      limit,
      { createdAt: -1 },
      populate
    );

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
    const deposit = await this.depositRequestRepository.findById(depositId);

    if (!deposit) {
      throw new Error("Deposit request not found");
    }

    // Populate user details
    await deposit.populate("userId", "firstName lastName email phone");

    return deposit;
  }

  async approveDeposit(depositId: string, approvedBy: string) {
    const deposit = await this.depositRequestRepository.findById(depositId);

    if (!deposit) {
      throw new Error("Deposit request not found");
    }

    if (deposit.status !== "pending") {
      throw new Error("Can only approve pending deposit requests");
    }

    // Find user's main wallet
    const wallet = await this.walletRepository.findOne({
      userId: deposit.userId,
      type: "main",
    });

    if (!wallet) {
      throw new Error("User wallet not found");
    }

    // Credit wallet
    const previousBalance = wallet.balance;
    wallet.balance += deposit.amount;
    await wallet.save();

    await this.transactionRepository.create({
      walletId: wallet.id,
      sourceId: deposit.userId,
      reference: `TXN_${deposit.reference}`,
      amount: deposit.amount,
      direction: "CREDIT",
      type: "manual_deposit",
      status: "success",
      purpose: "Manual deposit approved",
      remark: `Deposit request approved - ${deposit.reference}`,
      balanceBefore: previousBalance,
      balanceAfter: wallet.balance,
      initiatedBy: new Types.ObjectId(approvedBy),
      initiatedByType: "admin",
      transactableType: "DepositRequest",
      transactableId: new Types.ObjectId(depositId),
      approvalStatus: "approved",
      approvedBy: new Types.ObjectId(approvedBy),
      approvedAt: new Date(),
    });

    // Update deposit request status
    deposit.status = "approved";
    deposit.approvedAt = new Date();
    deposit.approvedBy = approvedBy;
    await deposit.save();

    // Send notification
    await this.notificationService.createNotification({
      notifiableType: "User",
      notifiableId: deposit.userId,
      type: "deposit",
      data: {
        title: "Deposit Approved",
        message: `Your deposit of ₦${deposit.amount.toLocaleString()} has been approved`,
        amount: deposit.amount,
        reference: deposit.reference,
      },
      sendEmail: true,
      sendSMS: false,
      sendPush: true,
    });

    return {
      message: "Deposit request approved successfully",
      deposit: {
        id: deposit._id,
        amount: deposit.amount,
        status: deposit.status,
        reference: deposit.reference,
        approvedAt: deposit.approvedAt,
        approvedBy: deposit.approvedBy,
      },
      wallet: {
        balance: wallet.balance,
        previousBalance,
      },
    };
  }

  async declineDeposit(depositId: string, reason: string, declinedBy: string) {
    if (!reason || reason.trim().length === 0) {
      throw new Error("Decline reason is required");
    }

    const deposit = await this.depositRequestRepository.findById(depositId);

    if (!deposit) {
      throw new Error("Deposit request not found");
    }

    if (deposit.status !== "pending") {
      throw new Error("Can only decline pending deposit requests");
    }

    // Update deposit request status
    deposit.status = "declined";
    deposit.declinedAt = new Date();
    deposit.declinedBy = declinedBy;
    deposit.declineReason = reason;
    await deposit.save();

    // Send notification
    await this.notificationService.createNotification({
      notifiableType: "User",
      notifiableId: deposit.userId,
      type: "deposit",
      data: {
        title: "Deposit Declined",
        message: `Your deposit of ₦${deposit.amount.toLocaleString()} was declined. Reason: ${reason}`,
        amount: deposit.amount,
        reference: deposit.reference,
        reason: reason,
      },
      sendEmail: true,
      sendSMS: false,
      sendPush: true,
    });

    return {
      message: "Deposit request declined successfully",
      deposit: {
        id: deposit._id,
        amount: deposit.amount,
        status: deposit.status,
        reference: deposit.reference,
        reason,
        declinedAt: deposit.declinedAt,
        declinedBy: deposit.declinedBy,
      },
    };
  }

  async getDepositStatistics(filters: any = {}) {
    const matchStage: any = {};

    if (filters.startDate && filters.endDate) {
      matchStage.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    if (filters.userId) {
      matchStage.userId = new Types.ObjectId(filters.userId);
    }

    const stats = await this.depositRequestRepository.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    const summary = {
      pending: { count: 0, totalAmount: 0 },
      approved: { count: 0, totalAmount: 0 },
      declined: { count: 0, totalAmount: 0 },
      total: { count: 0, totalAmount: 0 },
    };

    stats.forEach((stat) => {
      if (stat._id in summary) {
        summary[stat._id as keyof typeof summary] = {
          count: stat.count,
          totalAmount: stat.totalAmount,
        };
      }
      summary.total.count += stat.count;
      summary.total.totalAmount += stat.totalAmount;
    });

    return summary;
  }

  async bulkApproveDeposits(depositIds: string[], approvedBy: string) {
    const results = {
      successful: [] as any[],
      failed: [] as any[],
    };

    for (const depositId of depositIds) {
      try {
        const result = await this.approveDeposit(depositId, approvedBy);
        results.successful.push({
          depositId,
          ...result,
        });
      } catch (error) {
        results.failed.push({
          depositId,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return {
      message: `Processed ${depositIds.length} deposits: ${results.successful.length} approved, ${results.failed.length} failed`,
      results,
    };
  }
}
