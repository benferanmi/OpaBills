import { BaseRepository } from '../BaseRepository';
import { SystemBankAccount, ISystemBankAccount } from '@/models/admin/SystemBankAccount';

export class SystemBankAccountRepository extends BaseRepository<ISystemBankAccount> {
  constructor() {
    super(SystemBankAccount);
  }

  async findDefault(): Promise<ISystemBankAccount | null> {
    return await this.model.findOne({ isDefault: true, status: 'active' }).exec();
  }

  async findActive(): Promise<ISystemBankAccount[]> {
    return await this.model.find({ status: 'active' }).exec();
  }
}
