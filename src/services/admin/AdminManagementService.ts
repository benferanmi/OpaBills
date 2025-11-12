import { AdminRepository } from '@/repositories/admin/AdminRepository';
import { RoleRepository } from '@/repositories/admin/RoleRepository';
import bcrypt from 'bcrypt';

export class AdminManagementService {
  private adminRepository: AdminRepository;
  private roleRepository: RoleRepository;

  constructor() {
    this.adminRepository = new AdminRepository();
    this.roleRepository = new RoleRepository();
  }

  async listAdmins(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.adminLevel) {
      query.adminLevel = filters.adminLevel;
    }

    if (filters.search) {
      query.$or = [
        { firstName: { $regex: filters.search, $options: 'i' } },
        { lastName: { $regex: filters.search, $options: 'i' } },
        { email: { $regex: filters.search, $options: 'i' } },
      ];
    }

    const result = await this.adminRepository.findWithPagination(query, page, limit);

    return {
      admins: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createAdmin(data: any) {
    const existingAdmin = await this.adminRepository.findByEmail(data.email);
    if (existingAdmin) {
      throw new Error('Admin with this email already exists');
    }

    const temporaryPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(temporaryPassword, 10);

    const role = await this.roleRepository.findBySlug(data.adminLevel);
    if (!role) {
      throw new Error('Invalid admin level');
    }

    const adminData = {
      ...data,
      password: hashedPassword,
      permissions: role.permissions,
    };

    const admin = await this.adminRepository.create(adminData);

    return { 
      message: 'Admin created successfully', 
      admin,
      temporaryPassword 
    };
  }

  async getAdminDetails(adminId: string) {
    const admin = await this.adminRepository.findById(adminId);
    if (!admin) {
      throw new Error('Admin not found');
    }
    return admin;
  }

  async updateAdmin(adminId: string, data: any) {
    const admin = await this.adminRepository.findById(adminId);
    if (!admin) {
      throw new Error('Admin not found');
    }

    if (data.adminLevel) {
      const role = await this.roleRepository.findBySlug(data.adminLevel);
      if (!role) {
        throw new Error('Invalid admin level');
      }
      data.permissions = role.permissions;
    }

    Object.assign(admin, data);
    await admin.save();

    return { message: 'Admin updated successfully', admin };
  }

  async updateAdminStatus(adminId: string, status: string) {
    const admin = await this.adminRepository.findById(adminId);
    if (!admin) {
      throw new Error('Admin not found');
    }

    admin.status = status as any;
    await admin.save();

    return { message: 'Admin status updated successfully', status: admin.status };
  }

  async deleteAdmin(adminId: string) {
    await this.adminRepository.delete(adminId);
    return { message: 'Admin deleted successfully' };
  }

  async resetAdminPassword(adminId: string) {
    const admin = await this.adminRepository.findById(adminId);
    if (!admin) {
      throw new Error('Admin not found');
    }

    const newPassword = Math.random().toString(36).slice(-10);
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    admin.password = hashedPassword;
    await admin.save();

    return { 
      message: 'Password reset successfully', 
      newPassword 
    };
  }
}
