import { RoleRepository } from '@/repositories/admin/RoleRepository';
import { getAllPermissions } from '@/utils/admin-permissions';

export class RoleService {
  private roleRepository: RoleRepository;

  constructor() {
    this.roleRepository = new RoleRepository();
  }

  async listRoles(page: number = 1, limit: number = 20) {
    const result = await this.roleRepository.findWithPagination({}, page, limit);

    return {
      roles: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createRole(data: any) {
    const existingRole = await this.roleRepository.findBySlug(data.slug);
    if (existingRole) {
      throw new Error('Role with this slug already exists');
    }

    const role = await this.roleRepository.create(data);
    return { message: 'Role created successfully', role };
  }

  async getRoleDetails(roleId: string) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }
    return role;
  }

  async updateRole(roleId: string, data: any) {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new Error('Role not found');
    }

    Object.assign(role, data);
    await role.save();

    return { message: 'Role updated successfully', role };
  }

  async deleteRole(roleId: string) {
    await this.roleRepository.delete(roleId);
    return { message: 'Role deleted successfully' };
  }

  async getAllPermissions() {
    return getAllPermissions();
  }
}
