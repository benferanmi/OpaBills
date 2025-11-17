import axios from "axios";
import { smsConfig } from "@/config/sms";
import logger from "@/logger";

interface SMSOptions {
  to: string;
  message: string;
}

export class SMSService {
  private baseUrl: string;
  private apiKey: string;
  private senderId: string;

  constructor() {
    this.baseUrl = smsConfig.termii.baseUrl;
    this.apiKey = smsConfig.termii.apiKey;
    this.senderId = smsConfig.termii.senderId;
  }

  // async sendSMS(options: SMSOptions): Promise<void> {
  //   try {
  //     console.log(this.baseUrl, this.apiKey, this.senderId);

  //     const url = `${this.baseUrl}/sms/number/send`;
  //     console.log(url);

  //     const response = await axios.post(`${this.baseUrl}/sms/number/send`, {
  //       to: options.to,
  //       // from: this.senderId,
  //       sms: options.message,
  //       // type: "plain",
  //       // channel: "generic",
  //       api_key: this.apiKey,
  //     });

  //     console.log(response);

  //     logger.info(`SMS sent successfully to ${options.to}`, response.data);
  //   } catch (error: any) {
  //     console.log(error);
  //     logger.error("SMS sending failed:", error.data);
  //     throw error?.response?.data || error?.data || error;
  //   }
  // }

  async sendSMS(options: SMSOptions): Promise<void> {
    try {
      // Use the standard Messaging API endpoint instead
      const url = `${this.baseUrl}/sms/send`;

      const payload = {
        to: options.to.replace(/^\+/, ""),
        from: this.senderId, // Use your approved sender ID
        sms: options.message,
        type: "plain",
        channel: "generic", // or "dnd" for DND numbers
        api_key: this.apiKey,
      };

      logger.info(`Sending SMS via Messaging API to ${options.to}`);
      const response = await axios.post(url, payload);

      logger.info(`SMS sent successfully`, response.data);
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      logger.error("SMS sending failed:", errorData);
      throw new Error(`SMS sending failed: ${JSON.stringify(errorData)}`);
    }
  }

  async sendPhoneVerificationOTP(to: string, otp: string): Promise<void> {
    const message = `Your BillPadi verification code is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`;

    await this.sendSMS({ to, message });
  }

  async send2FAOTP(to: string, otp: string): Promise<void> {
    const message = `Your BillPadi 2FA code is: ${otp}. This code will expire in 10 minutes. If you didn't request this, please secure your account.`;

    await this.sendSMS({ to, message });
  }
}
