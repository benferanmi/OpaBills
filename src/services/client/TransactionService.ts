import { TransactionRepository } from "@/repositories/TransactionRepository";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";

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

  constructor() {
    this.transactionRepository = new TransactionRepository();
  }

  async getUserTransactions(
    userId: string,
    filters: TransactionFilters = {},
    page: number = 1,
    limit: number = 20
  ): Promise<any> {
    const query: any = { sourceId: userId };

    // Type filter
    if (filters.type) {
      query.type = filters.type;
    }

    // Status filter
    if (filters.status) {
      query.status = filters.status;
    }

    // Provider filter
    if (filters.provider) {
      query.provider = filters.provider;
    }

    // Direction filter
    if (filters.direction) {
      query.direction = filters.direction;
    }

    // Purpose filter
    if (filters.purpose) {
      query.purpose = filters.purpose;
    }

    // Reference filter (partial match)
    if (filters.reference) {
      query.reference = { $regex: filters.reference, $options: "i" };
    }

    // Date range filter
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

    // Price range filter
    if (filters.startPrice !== undefined || filters.endPrice !== undefined) {
      query.amount = {};
      if (filters.startPrice !== undefined) {
        query.amount.$gte = filters.startPrice;
      }
      if (filters.endPrice !== undefined) {
        query.amount.$lte = filters.endPrice;
      }
    }

    return this.transactionRepository.findWithFilters(query, page, limit);
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

    // Verify ownership
    if (transaction.sourceId?.toString() !== userId) {
      throw new AppError(
        "Unauthorized access to transaction",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    return transaction;
  }

  async exportTransactions(
    userId: string,
    filters: TransactionFilters = {}
  ): Promise<string> {
    const query: any = { sourceId: userId };

    // Apply same filters as getUserTransactions
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

    // Generate CSV
    const headers = [
      "Reference",
      "Type",
      "Direction",
      "Purpose",
      "Provider",
      "Amount",
      "Status",
      "Remark",
      "Date",
    ];

    const rows = result.data.map((t: any) => [
      t.reference,
      t.type || "",
      t.direction || "",
      t.purpose || "",
      t.provider || "",
      t.amount,
      t.status,
      t.remark || "",
      new Date(t.createdAt).toISOString(),
    ]);

    // Escape CSV values that contain commas or quotes
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

    // Verify ownership
    if (transaction.sourceId?.toString() !== userId) {
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

    return {
      receiptNumber: `RCP-${transaction.reference}`,
      reference: transaction.reference,
      providerReference: transaction.providerReference,
      amount: transaction.amount,
      direction: transaction.direction,
      type: transaction.type,
      purpose: transaction.purpose,
      provider: transaction.provider,
      status: transaction.status,
      remark: transaction.remark,
      meta: transaction.meta,
      transactionDate: transaction.createdAt,
      generatedAt: new Date(),
    };
  }
}
