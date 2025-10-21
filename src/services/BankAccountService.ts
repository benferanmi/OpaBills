import { BankAccountRepository } from '@/repositories/BankAccountRepository';
import { AppError } from '@/middlewares/errorHandler';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

export interface CreateBankAccountDTO {
  userId: string;
  bankId: string;
  accountNumber: string;
  accountName: string;
  recipientCode?: string;
}

export class BankAccountService {
  constructor(private bankAccountRepository: BankAccountRepository) {}

  async createBankAccount(data: CreateBankAccountDTO): Promise<any> {
    // Check if account already exists
    const existing = await this.bankAccountRepository.findByAccountNumber(data.userId, data.accountNumber);
    if (existing) {
      throw new AppError('Bank account already exists', HTTP_STATUS.CONFLICT, ERROR_CODES.DUPLICATE_ENTRY);
    }

    const bankAccount = await this.bankAccountRepository.create(data);
    return bankAccount;
  }

  async getUserBankAccounts(userId: string): Promise<any> {
    const accounts = await this.bankAccountRepository.findByUserId(userId);
    return accounts;
  }

  async getBankAccount(accountId: string): Promise<any> {
    const account = await this.bankAccountRepository.findById(accountId);
    if (!account) {
      throw new AppError('Bank account not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return account;
  }

  async deleteBankAccount(accountId: string): Promise<void> {
    await this.bankAccountRepository.softDelete(accountId);
  }
}
