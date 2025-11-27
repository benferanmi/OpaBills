import { HTTP_STATUS } from "@/utils/constants";
import logger from "@/logger";
import { CreateAdminRequest, UpdateAdminRequest } from "@/types/admin";
import { Admin, IAdmin } from "@/models/admin/Admin";
import { EmailService } from "../EmailService";
import { generatePasswordCrypto } from "@/utils/helpers";
import { AdminRepository } from "@/repositories/admin/AdminRepository";

export class AdminManagementService {
  private emailService = new EmailService();
  private adminRepository = new AdminRepository();
  async createAdmin(
    data: CreateAdminRequest,
    creatorId: string
  ): Promise<IAdmin> {
    const { firstName, lastName, email, adminLevel, phone } = data;

    try {
      // Check if admin with email already exists
      const existingAdmin = await this.adminRepository.findByEmail(email);
      if (existingAdmin) {
        throw {
          message: "Admin with this email already exists",
          statusCode: HTTP_STATUS.CONFLICT,
        };
      }

      const newPassword = generatePasswordCrypto();
      // Create admin data
      const adminData = {
        firstName,
        lastName,
        email: email.toLowerCase(),
        password: newPassword,
        adminLevel,
        phone,
        createdBy: creatorId,
      };

      // Create and save admin
      const admin = await this.adminRepository.create(adminData);

      await this.emailService.sendAdminWelcomeEmail(
        admin.email,
        admin.firstName,
        admin.adminLevel,
        newPassword
      );

      logger.info("Admin account created successfully", {
        adminId: admin._id.toString(),
        email: admin.email,
        adminLevel: admin.adminLevel,
        createdBy: creatorId,
      });

      return admin;
    } catch (error: any) {
      logger.error("Failed to create admin account", {
        email,
        error: error.message,
        createdBy: creatorId,
      });
      throw error;
    }
  }

  async getAllAdmins(query: {
    page?: number;
    limit?: number;
    adminLevel?: string;
    status?: string;
    search?: string;
  }) {
    const { page = 1, limit = 10, adminLevel, status, search } = query;

    const filter: any = {};

    // Build filter object
    if (adminLevel) filter.adminLevel = adminLevel;
    if (status) filter.status = status;
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
      ];
    }

    const skip = (page - 1) * limit;

    const [admins, total] = await Promise.all([
      Admin.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }).exec(),
      Admin.countDocuments(filter),
    ]);

    return {
      admins,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  async getAdminById(adminId: string): Promise<IAdmin> {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      throw {
        message: "Admin not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
      };
    }
    return admin;
  }

  async updateAdmin(
    adminId: string,
    data: UpdateAdminRequest,
    updatedBy: string
  ): Promise<IAdmin> {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      throw {
        message: "Admin not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
      };
    }

    // Update allowed fields
    const allowedUpdates = [
      "firstName",
      "lastName",
      "phone",
      "status",
      "permissions",
      "adminLevel",
    ];

    allowedUpdates.forEach((field) => {
      if ((data as any)[field] !== undefined) {
        (admin as any)[field] = (data as any)[field];
      }
    });

    admin.updatedBy = updatedBy;
    await admin.save();

    logger.info("Admin account updated", {
      adminId,
      updatedBy,
      updatedFields: Object.keys(data),
    });

    return admin;
  }

  async deactivateAdmin(adminId: string, deactivatedBy: string): Promise<void> {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      throw {
        message: "Admin not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
      };
    }

    if (admin.adminLevel === "super_admin") {
      throw {
        message: "Cannot delete super admin account",
        statusCode: HTTP_STATUS.FORBIDDEN,
      };
    }

    await Admin.findByIdAndDelete(adminId);

    logger.info("Admin account deleted", {
      adminId,
      deactivatedBy,
    });
  }

  async resetAdminPassword(adminId: string, resetBy: string): Promise<void> {
    const admin = await Admin.findById(adminId);
    if (!admin) {
      throw {
        message: "Admin not found",
        statusCode: HTTP_STATUS.NOT_FOUND,
      };
    }

    const generatedPassword = generatePasswordCrypto();

    admin.password = generatedPassword;
    admin.updatedBy = resetBy;
    await admin.save();

    // Send password reset notification
    await this.emailService.sendPasswordResetConfirmation(
      admin.email,
      admin.firstName,
      generatedPassword
    );

    logger.info("Admin password reset", {
      adminId,
      resetBy,
    });
  }

  async getAdminStatistics() {
    const stats = await Admin.aggregate([
      {
        $group: {
          _id: "$adminLevel",
          count: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          suspended: {
            $sum: { $cond: [{ $eq: ["$status", "suspended"] }, 1, 0] },
          },
          deactivated: {
            $sum: { $cond: [{ $eq: ["$status", "deactivated"] }, 1, 0] },
          },
        },
      },
    ]);

    const totalStats = await Admin.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          active: {
            $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] },
          },
          recentLogins: {
            $sum: {
              $cond: [
                {
                  $gte: [
                    "$lastLogin",
                    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    return {
      byLevel: stats,
      overall: totalStats[0] || { total: 0, active: 0, recentLogins: 0 },
    };
  }
}
