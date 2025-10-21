import { TransactionRepository } from '@/repositories/TransactionRepository';
import { WalletService } from './WalletService';
import { generateReference } from '@/utils/helpers';
import { AppError } from '@/middlewares/errorHandler';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

export interface CreateTransactionDTO {
  userId: string;
  amount: number;
  type: string;
  provider: string;
  remark?: string;
  purpose?: string;
  meta?: any;
}

export class TransactionService {
  constructor(
    private transactionRepository: TransactionRepository,
    private walletService: WalletService
  ) {}

  async createTransaction(data: CreateTransactionDTO): Promise<any> {
    const reference = generateReference('TXN');

    const transaction = await this.transactionRepository.create({
      reference,
      amount: data.amount,
      type: data.type,
      provider: data.provider,
      remark: data.remark,
      purpose: data.purpose,
      status: 'pending',
      meta: data.meta,
    });

    return {
      id: transaction._id,
      reference: transaction.reference,
      amount: transaction.amount,
      type: transaction.type,
      status: transaction.status,
      createdAt: transaction.createdAt,
    };
  }

  async getTransaction(reference: string): Promise<any> {
    const transaction = await this.transactionRepository.findByReference(reference);
    if (!transaction) {
      throw new AppError('Transaction not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return transaction;
  }

  async getUserTransactions(userId: string, page: number = 1, limit: number = 10): Promise<any> {
    const { data, total } = await this.transactionRepository.findByUserId(userId, page, limit);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async updateTransactionStatus(
    reference: string,
    status: 'pending' | 'success' | 'failed' | 'reversed'
  ): Promise<any> {
    const transaction = await this.transactionRepository.findByReference(reference);
    if (!transaction) {
      throw new AppError('Transaction not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const updated = await this.transactionRepository.updateStatus(transaction._id, status);
    return updated;
  }
}
