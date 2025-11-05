import { BaseRepository } from '../BaseRepository';
import { Role, IRole } from '@/models/admin/Role';

export class RoleRepository extends BaseRepository<IRole> {
  constructor() {
    super(Role);
  }

  async findBySlug(slug: string): Promise<IRole | null> {
    return await this.model.findOne({ slug }).exec();
  }

  async findActiveRoles(): Promise<IRole[]> {
    return await this.model.find({ status: 'active' }).exec();
  }
}
