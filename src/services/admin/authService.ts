import { Admin } from "@/models/admin/Index";
import { RefreshToken } from "@/models/admin/RefreshToken";
import { bcryptUtil } from "@/utils/bcryptjs";


export class AuthService {
    private otpService = new OTPService();

    async login(data: LoginRequest, ip?: string, userAgent?: string) {
        const { email, password } = data;

        const admin = await Admin.findOne({ email }).select("+password");
        if (!admin) {
            throw {
                message: "Invalid credentials",
                statusCode: HTTP_STATUS.UNAUTHORIZED,
            };
        }

        if (admin.isLocked()) {
            throw { message: "Account is locked", statusCode: HTTP_STATUS.UNAUTHORIZED };
        }

        const isPasswordValid = await admin.comparePassword(password);
        if (!isPasswordValid) {
            await admin.incrementLoginAttempts();
            throw {
                message: "Invalid credentials",
                statusCode: HTTP_STATUS.UNAUTHORIZED,
            };
        }

        // Reset login attempts and update last login
        await admin.resetLoginAttempts();
        admin.lastLogin = new Date();
        await admin.save();

        const tokens = adminJwtUtil.generateTokenPair({
            adminId: admin._id.toString(),
            email: admin.email,
            adminLevel: admin.adminLevel,
            permissions: admin.permissions,
        });

        // Save refresh token
        await this.saveRefreshToken(
            tokens.tokenId,
            admin._id.toString(),
            "admin",
            tokens.refreshToken,
            ip,
            userAgent
        );

        return {
            admin: {
                id: admin._id.toString(),
                email: admin.email,
                firstName: admin.firstName,
                lastName: admin.lastName,
                adminLevel: admin.adminLevel,
            },
            tokens: {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
                expiresIn: tokens.expiresIn,
            },
        };
    }

}