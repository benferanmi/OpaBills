import { CacheService } from "./CacheService";
import { generateOTP } from "@/utils/cryptography";
import { CACHE_TTL } from "@/utils/constants";
import { EmailService } from "./EmailService";

export class OTPService {
  private cacheService: CacheService;
  private otpLength: number = 6;
  private otpTTL: number = CACHE_TTL.TEN_MINUTES;
  private emailService: EmailService = new EmailService();

  constructor() {
    this.cacheService = new CacheService();
  }

  async generateAndStore(
    userId: string,
    purpose:
      | "email_verification"
      | "phone_verification"
      | "2fa"
      | "password_reset"
      | "forgot_password",
    name: string
  ): Promise<string> {
    const otp = generateOTP(this.otpLength);
    const key = this.getKey(userId, purpose);

    await this.cacheService.set(key, otp, this.otpTTL);
    await this.emailService.sendForgotPasswordEmail(userId, otp, name);

    return otp;
  }

  async verify(
    userId: string,
    purpose:
      | "email_verification"
      | "phone_verification"
      | "2fa"
      | "password_reset"
      | "forgot_password",
    otp: string
  ): Promise<boolean> {
    const key = this.getKey(userId, purpose);
    const storedOTP = await this.cacheService.get<string>(key);

    if (!storedOTP || storedOTP !== otp) {
      return false;
    }

    // Delete OTP after successful verification
    await this.cacheService.delete(key);
    return true;
  }

  async delete(
    userId: string,
    purpose:
      | "email_verification"
      | "phone_verification"
      | "2fa"
      | "password_reset"
      | "forgot_password"
  ): Promise<void> {
    const key = this.getKey(userId, purpose);
    await this.cacheService.delete(key);
  }

  async exists(
    userId: string,
    purpose:
      | "email_verification"
      | "phone_verification"
      | "2fa"
      | "password_reset"
      | "forgot_password"
  ): Promise<boolean> {
    const key = this.getKey(userId, purpose);
    return await this.cacheService.exists(key);
  }

  private getKey(userId: string, purpose: string): string {
    return `otp:${purpose}:${userId}`;
  }
}