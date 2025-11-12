import { AdminRepository } from '@/repositories/admin/AdminRepository';
import { RoleRepository } from '@/repositories/admin/RoleRepository';
import { EmailService } from '@/services/EmailService';
import { OTPService } from '@/services/OTPService';
import { generateOTP } from '@/utils/cryptography';

export class AdminUserService {
  private adminRepository: AdminRepository;
  private roleRepository: RoleRepository;
  private emailService: EmailService;
  private otpService: OTPService;

  constructor() {
    this.adminRepository = new AdminRepository();
    this.roleRepository = new RoleRepository();
    this.emailService = new EmailService();
    this.otpService = new OTPService();
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
      admins: result.data.map((admin) => ({
        id: admin._id,
        firstName: admin.firstName,
        lastName: admin.lastName,
        fullName: admin.fullName,
        email: admin.email,
        status: admin.status,
        adminLevel: admin.adminLevel,
        department: admin.department,
        lastLogin: admin.lastLogin,
        totalLogins: admin.totalLogins,
        createdAt: admin.createdAt,
      })),
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createAdmin(data: any, createdBy: string) {
    const existingAdmin = await this.adminRepository.findByEmail(data.email);

    if (existingAdmin) {
      throw new Error('Admin with this email already exists');
    }

    const tempPassword = generateOTP(8);

    const admin = await this.adminRepository.create({
      ...data,
      password: tempPassword,
      createdBy,
      status: 'pending_verification',
    });

    // Send welcome email with temporary password
    //TODO
    // await this.emailService.sendAdminWelcomeEmail(
    //   admin.email,
    //   tempPassword,
    //   admin.fullName
    // );

    return {
      admin: {
        id: admin._id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        adminLevel: admin.adminLevel,
      },
      message: 'Admin created successfully. Welcome email sent.',
    };
  }

  async getAdminDetails(adminId: string) {
    const admin = await this.adminRepository.findById(adminId);

    if (!admin) {
      throw new Error('Admin not found');
    }

    return {
      id: admin._id,
      firstName: admin.firstName,
      lastName: admin.lastName,
      fullName: admin.fullName,
      email: admin.email,
      phone: admin.phone,
      status: admin.status,
      adminLevel: admin.adminLevel,
      permissions: admin.permissions,
      department: admin.department,
      twoFactorEnabled: admin.twoFactorEnabled,
      lastLogin: admin.lastLogin,
      lastActiveAt: admin.lastActiveAt,
      totalLogins: admin.totalLogins,
      profilePicture: admin.profilePicture,
      createdAt: admin.createdAt,
      updatedAt: admin.updatedAt,
    };
  }

  async updateAdmin(adminId: string, data: any, updatedBy: string) {
    const admin = await this.adminRepository.findById(adminId);

    if (!admin) {
      throw new Error('Admin not found');
    }

    if (data.status) admin.status = data.status;
    if (data.adminLevel) admin.adminLevel = data.adminLevel;
    if (data.department) admin.department = data.department;
    if (data.permissions) admin.permissions = data.permissions;

    admin.updatedBy = updatedBy;
    await admin.save();

    return {
      message: 'Admin updated successfully',
      admin: {
        id: admin._id,
        status: admin.status,
        adminLevel: admin.adminLevel,
      },
    };
  }

  async assignRole(adminId: string, roleId: string, updatedBy: string) {
    const admin = await this.adminRepository.findById(adminId);
    const role = await this.roleRepository.findById(roleId);

    if (!admin) {
      throw new Error('Admin not found');
    }

    if (!role) {
      throw new Error('Role not found');
    }

    admin.adminLevel = role.name;
    admin.permissions = role.permissions;
    admin.updatedBy = updatedBy;
    await admin.save();

    return {
      message: 'Role assigned successfully',
      admin: {
        id: admin._id,
        adminLevel: admin.adminLevel,
        permissions: admin.permissions,
      },
    };
  }
}
