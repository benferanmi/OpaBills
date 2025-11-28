import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletRepository } from "@/repositories/WalletRepository";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { TransactionMapper } from "@/utils/TransactionMapper";

export interface TransactionFilters {
  type?: string;
  status?: string;
  provider?: string;
  direction?: string;
  purpose?: string;
  reference?: string;
  startDate?: string;
  endDate?: string;
  startPrice?: number;
  endPrice?: number;
}

export class TransactionService {
  private transactionRepository: TransactionRepository;
  private walletRepository: WalletRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.walletRepository = new WalletRepository();
  }

  async getUserTransactions(
    userId: string,
    filters: TransactionFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const query: any = { walletId: wallet._id };

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.provider) {
      query.provider = filters.provider;
    }

    if (filters.direction) {
      query.direction = filters.direction;
    }

    if (filters.purpose) {
      query.purpose = filters.purpose;
    }

    if (filters.reference) {
      query.reference = { $regex: filters.reference, $options: "i" };
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        // Set to end of day
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    if (filters.startPrice !== undefined || filters.endPrice !== undefined) {
      query.amount = {};
      if (filters.startPrice !== undefined) {
        query.amount.$gte = filters.startPrice;
      }
      if (filters.endPrice !== undefined) {
        query.amount.$lte = filters.endPrice;
      }
    }

    const result = await this.transactionRepository.findWithFilters(
      query,
      page,
      limit
    );

    return TransactionMapper.toPaginatedDTO(
      result.data,
      result.total,
      page,
      limit
    );
  }

  async getTransaction(reference: string, userId: string): Promise<any> {
    const transaction = await this.transactionRepository.findByReference(
      reference
    );

    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet || transaction.walletId?.toString() !== wallet.id.toString()) {
      throw new AppError(
        "Unauthorized access to transaction",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    return TransactionMapper.toDTO(transaction);
  }

  async exportTransactions(
    userId: string,
    filters: TransactionFilters = {}
  ): Promise<string> {
    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const query: any = { walletId: wallet._id };

    if (filters.type) query.type = filters.type;
    if (filters.status) query.status = filters.status;
    if (filters.provider) query.provider = filters.provider;
    if (filters.direction) query.direction = filters.direction;
    if (filters.purpose) query.purpose = filters.purpose;

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    const result = await this.transactionRepository.findWithFilters(
      query,
      1,
      10000
    );

    const sanitizedData = TransactionMapper.toDTOList(result.data);

    const headers = [
      "Reference",
      "Type",
      "Direction",
      "Description",
      "Amount",
      "Status",
      "Balance Before",
      "Balance After",
      "Date",
    ];

    const rows = sanitizedData.map((t: any) => [
      t.reference,
      t.type || "",
      t.direction || "",
      t.description || "",
      t.amount,
      t.status,
      t.balanceBefore || "",
      t.balanceAfter || "",
      new Date(t.createdAt).toISOString(),
    ]);

    const escapeCsvValue = (value: any): string => {
      const strValue = String(value);
      if (
        strValue.includes(",") ||
        strValue.includes('"') ||
        strValue.includes("\n")
      ) {
        return `"${strValue.replace(/"/g, '""')}"`;
      }
      return strValue;
    };

    const csv = [
      headers.join(","),
      ...rows.map((row: any[]) => row.map(escapeCsvValue).join(",")),
    ].join("\n");

    return csv;
  }

  async generateReceipt(reference: string, userId: string): Promise<any> {
    const transaction = await this.transactionRepository.findByReference(
      reference
    );

    if (!transaction) {
      throw new AppError(
        "Transaction not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet || transaction.walletId?.toString() !== wallet.id.toString()) {
      throw new AppError(
        "Unauthorized access to transaction",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    // Only generate receipts for successful transactions
    if (transaction.status !== "success") {
      throw new AppError(
        "Receipt can only be generated for successful transactions",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.BAD_REQUEST
      );
    }

    const sanitized = TransactionMapper.toDTO(transaction);

    return {
      receiptNumber: `RCP-${sanitized.reference}`,
      reference: sanitized.reference,
      amount: sanitized.amount,
      direction: sanitized.direction,
      type: sanitized.type,
      status: sanitized.status,
      description: sanitized.description,
      balanceBefore: sanitized.balanceBefore,
      balanceAfter: sanitized.balanceAfter,
      metadata: sanitized.metadata,
      transactionDate: sanitized.createdAt,
      generatedAt: new Date(),
    };
  }
}
