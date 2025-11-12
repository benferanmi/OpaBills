import { SystemBankAccountRepository } from '@/repositories/admin/SystemBankAccountRepository';

export class SystemBankAccountService {
  private bankAccountRepository: SystemBankAccountRepository;

  constructor() {
    this.bankAccountRepository = new SystemBankAccountRepository();
  }

  async listBankAccounts(page: number = 1, limit: number = 20) {
    const result = await this.bankAccountRepository.findWithPagination({}, page, limit);

    return {
      bankAccounts: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createBankAccount(data: any) {
    const bankAccount = await this.bankAccountRepository.create(data);
    return { message: 'Bank account created successfully', bankAccount };
  }

  async updateBankAccountStatus(accountId: string, status: string) {
    const bankAccount = await this.bankAccountRepository.findById(accountId);
    if (!bankAccount) {
      throw new Error('Bank account not found');
    }

    bankAccount.status = status as any;
    await bankAccount.save();

    return { message: 'Bank account status updated successfully', status: bankAccount.status };
  }

  async deleteBankAccount(accountId: string) {
    await this.bankAccountRepository.delete(accountId);
    return { message: 'Bank account deleted successfully' };
  }
}
