import logger from "@/logger";
import { Admin } from "@/models/admin/Admin";
import bcryptUtil from "@/utils/bcryptjs";
import { HTTP_STATUS } from "@/utils/constants";

interface UpdateProfileData {
  firstName: string;
  lastName: string;
  profilePicture?: string;
  phone: string;
}

export class ProfileService {
  async changePassword(
    adminId: string,
    newPassword: string,
    currentPassword: string
  ) {
    const admin = await Admin.findById(adminId).select(
      "+password +passwordHistory"
    );
    if (!admin) {
      throw { message: "Admin not found", statusCode: HTTP_STATUS.NOT_FOUND };
    }

    const isCurrentPasswordValid = await admin.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      throw {
        message: "Current password is incorrect",
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    if (
      await bcryptUtil.isPasswordInHistory(newPassword, admin.passwordHistory)
    ) {
      throw {
        message: "Cannot reuse recent passwords",
        statusCode: HTTP_STATUS.BAD_REQUEST,
      };
    }

    //Update password
    admin.password = newPassword;

    const hashedPassword = await bcryptUtil.hashPassword(newPassword);
    admin.passwordHistory = bcryptUtil.updatePasswordHistory(
      admin.passwordHistory,
      hashedPassword
    );
    admin.updatedAt = new Date();
    await admin.save();

    logger.info("Admin password changed", { adminId });
  }

  async fetchProfile(adminId: string) {
    const profile = await Admin.findById(adminId).lean();
    return profile;
  }

  async updateAdminProfile(userId: string, data: UpdateProfileData) {
    const admin = await Admin.findById(userId);
    if (!admin) {
      throw { message: "Admin not found", statusCode: HTTP_STATUS.NOT_FOUND };
    }

    // Update fields if provided
    if (data.firstName) admin.firstName = data.firstName;
    if (data.lastName) admin.lastName = data.lastName;
    if (data.phone) admin.phone = data.phone;
    if (data.profilePicture) admin.profilePicture = data.profilePicture;

    admin.updatedAt = new Date();
    await admin.save();

    return admin;
  }

  async enable2FA(adminId: string) {
    await Admin.findByIdAndUpdate(
      adminId,
      {
        twoFactorEnabled: true,
        updatedAt: new Date(),
      },
      { new: true }
    );

    return { success: true, message: "2FA enable successfully" };
  }

  async disable2FA(adminId: string) {
    await Admin.findByIdAndUpdate(
      adminId,
      {
        twoFactorEnabled: false,
        updatedAt: new Date(),
      },
      { new: true }
    );

    return { success: true, message: "2FA disabled successfully" };
  }
}
