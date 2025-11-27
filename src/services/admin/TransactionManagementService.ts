import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletRepository } from "@/repositories/WalletRepository";

export class TransactionManagementService {
  private transactionRepository: TransactionRepository;
  private walletRepository: WalletRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.walletRepository = new WalletRepository();
  }

  async listTransactions(
    page: number = 1,
    limit: number = 20,
    filters: any = {}
  ) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
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

    if (filters.reference) {
      query.reference = { $regex: filters.reference, $options: "i" };
    }

    if (filters.minAmount || filters.maxAmount) {
      query.amount = {};
      if (filters.minAmount) query.amount.$gte = parseFloat(filters.minAmount);
      if (filters.maxAmount) query.amount.$lte = parseFloat(filters.maxAmount);
    }

    const result = await this.transactionRepository.findWithPagination(
      query,
      page,
      limit
    );

    return {
      transactions: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async getTransactionDetails(transactionId: string) {
    const transaction = await this.transactionRepository.findById(
      transactionId
    );

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    return transaction;
  }

  async updateTransactionStatus(
    transactionId: string,
    status: string,
    note?: string
  ) {
    const transaction = await this.transactionRepository.findById(
      transactionId
    );

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.status === "success" || transaction.status === "reversed") {
      throw new Error("Cannot update completed or reversed transactions");
    }

    transaction.status = status as any;
    if (note) {
      transaction.remark = note;
    }

    await transaction.save();

    // If marking as failed, refund the user
    if (status === "failed" && transaction.walletId) {
      const wallet = await this.walletRepository.findById(
        transaction.walletId.toString()
      );
      if (wallet) {
        const balanceBefore = wallet.balance;
        wallet.balance += transaction.amount;
        await wallet.save();

        await this.transactionRepository.create({
          walletId: wallet.id,
          sourceId: wallet.userId,
          reference: `REFUND-${transaction.reference}`,
          amount: transaction.amount,
          direction: "CREDIT",
          type: "refund",
          status: "success",
          purpose: "Refund for failed transaction",
          remark: `Refund for failed transaction ${transaction.reference}`,
          balanceBefore,
          balanceAfter: wallet.balance,
          initiatedByType: "system",
          transactableType: "Transaction",
          transactableId: transaction.id,
        });
      }
    }

    return {
      message: "Transaction status updated successfully",
      transaction: {
        id: transaction._id,
        status: transaction.status,
        reference: transaction.reference,
      },
    };
  }
}
