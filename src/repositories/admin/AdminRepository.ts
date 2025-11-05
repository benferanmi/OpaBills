import { BaseRepository } from '../BaseRepository';
import { Admin, IAdmin } from '@/models/admin/Admin';

export class AdminRepository extends BaseRepository<IAdmin> {
  constructor() {
    super(Admin);
  }

  async findByEmail(email: string): Promise<IAdmin | null> {
    return await this.model.findOne({ email }).exec();
  }

  async findActiveAdmins(): Promise<IAdmin[]> {
    return await this.model.find({ status: 'active' }).select('-password -passwordHistory').exec();
  }
}
