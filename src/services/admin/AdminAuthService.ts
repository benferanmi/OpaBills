// import { AdminRepository } from '@/repositories/admin/AdminRepository';
// import { generateAdminAccessToken, generateAdminRefreshToken } from '@/config/admin-jwt';
// import { OTPService } from '@/services/OTPService';
// import { EmailService } from '@/services/EmailService';
// import { v4 as uuidv4 } from 'uuid';

// export class AdminAuthService {
//   private adminRepository: AdminRepository;
//   private otpService: OTPService;
//   private emailService: EmailService;

//   constructor() {
//     this.adminRepository = new AdminRepository();
//     this.otpService = new OTPService();
//     this.emailService = new EmailService();
//   }

//   async login(email: string, password: string) {
//     const admin = await this.adminRepository.findByEmail(email.toLowerCase());

//     if (!admin) {
//       throw new Error('Invalid credentials');
//     }

//     if (admin.isLocked()) {
//       throw new Error('Account is temporarily locked due to multiple failed login attempts');
//     }

//     const isMatch = await admin.comparePassword(password);

//     if (!isMatch) {
//       await admin.incrementLoginAttempts();
//       throw new Error('Invalid credentials');
//     }

//     if (admin.status !== 'active') {
//       throw new Error(`Account is ${admin.status}`);
//     }

//     await admin.resetLoginAttempts();

//     // Generate 2FA code if enabled
//     if (admin.twoFactorEnabled) {
//       const otp = this.otpService.generateOTP();
//       admin.otp = otp;
//       admin.otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
//       await admin.save();

//       await this.emailService.send2FACode(admin.email, otp, admin.fullName);

//       return {
//         requiresTwoFactor: true,
//         message: '2FA code sent to your email',
//       };
//     }

//     // Generate tokens
//     const tokenId = uuidv4();
//     admin.activeTokenId = tokenId;
//     admin.lastLogin = new Date();
//     admin.totalLogins += 1;
//     await admin.save();

//     const accessToken = generateAdminAccessToken({
//       id: admin._id.toString(),
//       email: admin.email,
//       adminLevel: admin.adminLevel,
//       permissions: admin.permissions,
//     });

//     const refreshToken = generateAdminRefreshToken({
//       id: admin._id.toString(),
//       email: admin.email,
//       adminLevel: admin.adminLevel,
//       permissions: admin.permissions,
//     });

//     return {
//       accessToken,
//       refreshToken,
//       admin: {
//         id: admin._id,
//         email: admin.email,
//         firstName: admin.firstName,
//         lastName: admin.lastName,
//         adminLevel: admin.adminLevel,
//         permissions: admin.permissions,
//       },
//     };
//   }

//   async verify2FA(email: string, otp: string) {
//     const admin = await this.adminRepository.findByEmail(email.toLowerCase());

//     if (!admin) {
//       throw new Error('Admin not found');
//     }

//     if (!admin.otp || admin.otp !== otp) {
//       throw new Error('Invalid OTP');
//     }

//     if (!admin.otpExpiry || admin.otpExpiry < new Date()) {
//       throw new Error('OTP has expired');
//     }

//     admin.otp = undefined;
//     admin.otpExpiry = undefined;

//     const tokenId = uuidv4();
//     admin.activeTokenId = tokenId;
//     admin.lastLogin = new Date();
//     admin.totalLogins += 1;
//     await admin.save();

//     const accessToken = generateAdminAccessToken({
//       id: admin._id.toString(),
//       email: admin.email,
//       adminLevel: admin.adminLevel,
//       permissions: admin.permissions,
//     });

//     const refreshToken = generateAdminRefreshToken({
//       id: admin._id.toString(),
//       email: admin.email,
//       adminLevel: admin.adminLevel,
//       permissions: admin.permissions,
//     });

//     return {
//       accessToken,
//       refreshToken,
//       admin: {
//         id: admin._id,
//         email: admin.email,
//         firstName: admin.firstName,
//         lastName: admin.lastName,
//         adminLevel: admin.adminLevel,
//         permissions: admin.permissions,
//       },
//     };
//   }

//   async resend2FA(email: string) {
//     const admin = await this.adminRepository.findByEmail(email.toLowerCase());

//     if (!admin) {
//       throw new Error('Admin not found');
//     }

//     if (!admin.twoFactorEnabled) {
//       throw new Error('2FA is not enabled for this account');
//     }

//     const otp = this.otpService.generateOTP();
//     admin.otp = otp;
//     admin.otpExpiry = new Date(Date.now() + 10 * 60 * 1000);
//     await admin.save();

//     await this.emailService.send2FACode(admin.email, otp, admin.fullName);

//     return { message: '2FA code resent successfully' };
//   }

//   async toggle2FA(adminId: string, enable: boolean) {
//     const admin = await this.adminRepository.findById(adminId);

//     if (!admin) {
//       throw new Error('Admin not found');
//     }

//     admin.twoFactorEnabled = enable;
//     await admin.save();

//     return {
//       twoFactorEnabled: admin.twoFactorEnabled,
//       message: `2FA ${enable ? 'enabled' : 'disabled'} successfully`,
//     };
//   }

//   async sendPasswordResetToken(email: string) {
//     const admin = await this.adminRepository.findByEmail(email.toLowerCase());

//     if (!admin) {
//       return { message: 'If an account exists, a reset link has been sent' };
//     }

//     const token = this.otpService.generateOTP(6);
//     admin.otp = token;
//     admin.otpExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
//     await admin.save();

//     await this.emailService.sendPasswordResetEmail(admin.email, token, admin.fullName);

//     return { message: 'Password reset token sent successfully' };
//   }

//   async verifyPasswordResetToken(email: string, token: string) {
//     const admin = await this.adminRepository.findByEmail(email.toLowerCase());

//     if (!admin || !admin.otp || admin.otp !== token) {
//       throw new Error('Invalid or expired token');
//     }

//     if (!admin.otpExpiry || admin.otpExpiry < new Date()) {
//       throw new Error('Token has expired');
//     }

//     return { message: 'Token verified successfully' };
//   }

//   async resetPassword(email: string, token: string, newPassword: string) {
//     const admin = await this.adminRepository.findByEmail(email.toLowerCase());

//     if (!admin || !admin.otp || admin.otp !== token) {
//       throw new Error('Invalid or expired token');
//     }

//     if (!admin.otpExpiry || admin.otpExpiry < new Date()) {
//       throw new Error('Token has expired');
//     }

//     // Check password history
//     for (const oldPassword of admin.passwordHistory) {
//       const isSame = await admin.comparePassword(oldPassword);
//       if (isSame) {
//         throw new Error('Cannot reuse previous passwords');
//       }
//     }

//     // Add current password to history
//     admin.passwordHistory.push(admin.password);
//     if (admin.passwordHistory.length > 5) {
//       admin.passwordHistory.shift();
//     }

//     admin.password = newPassword;
//     admin.otp = undefined;
//     admin.otpExpiry = undefined;
//     admin.activeTokenId = null; // Invalidate all tokens
//     await admin.save();

//     return { message: 'Password reset successfully' };
//   }

//   async updatePassword(adminId: string, currentPassword: string, newPassword: string) {
//     const admin = await this.adminRepository.findById(adminId);

//     if (!admin) {
//       throw new Error('Admin not found');
//     }

//     const isMatch = await admin.comparePassword(currentPassword);

//     if (!isMatch) {
//       throw new Error('Current password is incorrect');
//     }

//     // Check password history
//     for (const oldPassword of admin.passwordHistory) {
//       const isSame = await admin.comparePassword(oldPassword);
//       if (isSame) {
//         throw new Error('Cannot reuse previous passwords');
//       }
//     }

//     admin.passwordHistory.push(admin.password);
//     if (admin.passwordHistory.length > 5) {
//       admin.passwordHistory.shift();
//     }

//     admin.password = newPassword;
//     await admin.save();

//     return { message: 'Password updated successfully' };
//   }

//   async updateProfile(adminId: string, data: any) {
//     const admin = await this.adminRepository.findById(adminId);

//     if (!admin) {
//       throw new Error('Admin not found');
//     }

//     if (data.firstName) admin.firstName = data.firstName;
//     if (data.lastName) admin.lastName = data.lastName;
//     if (data.phone) admin.phone = data.phone;
//     if (data.department) admin.department = data.department;

//     await admin.save();

//     return {
//       admin: {
//         id: admin._id,
//         email: admin.email,
//         firstName: admin.firstName,
//         lastName: admin.lastName,
//         phone: admin.phone,
//         department: admin.department,
//       },
//     };
//   }

//   async logout(adminId: string) {
//     const admin = await this.adminRepository.findById(adminId);

//     if (admin) {
//       admin.activeTokenId = null;
//       await admin.save();
//     }

//     return { message: 'Logged out successfully' };
//   }
// }
