import nodemailer from "nodemailer";
import FormData from "form-data";
import Mailgun from "mailgun.js";
import { emailConfig } from "@/config/email";
import logger from "@/logger";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private transporter: any;
  private mailgunClient: any;

  constructor() {
    if (emailConfig.transport === "mailgun") {
      this.initializeMailgun();
    } else if (emailConfig.transport === "smtp") {
      this.initializeSMTP();
    } else if (emailConfig.transport === "gmail") {
      this.initializeGmail();
    } else {
      throw new Error("Invalid email transport configuration");
    }
  }

  private initializeMailgun() {
    logger.debug("Initializing Mailgun transport...");
    const mailgun = new Mailgun(FormData);
    this.mailgunClient = mailgun.client({
      username: "api",
      key: emailConfig.mailgun.apiKey,
      url: `https://${emailConfig.mailgun.host}`,
    });
  }

  private initializeSMTP() {
    logger.debug("Initializing SMTP transport...");
    this.transporter = nodemailer.createTransport({
      host: emailConfig.smtp.host,
      port: emailConfig.smtp.port,
      secure: emailConfig.smtp.secure,
      auth: emailConfig.smtp.auth,
    });
  }

  private initializeGmail() {
    logger.debug("Initializing Gmail transport...");

    this.transporter = nodemailer.createTransport({
      service: emailConfig.gmail.service || "gmail",
      // auth: emailConfig.gmail.auth,
      auth: {
        user: emailConfig.gmail.auth.user || process.env.EMAIL_USER,
        pass: emailConfig.gmail.auth.pass || process.env.EMAIL_PASSWORD,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<void> {
    try {
      if (emailConfig.transport === "mailgun") {
        await this.sendViaMailgun(options);
      } else {
        await this.sendViaSMTP(options);
      }
      logger.info(`Email sent successfully to ${options.to}`);
    } catch (error) {
      logger.error("Email sending failed:", error);
      throw error;
    }
  }

  private async sendViaMailgun(options: EmailOptions): Promise<void> {
    const messageData = {
      from: `${emailConfig.fromName} <${emailConfig.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || "",
    };

    await this.mailgunClient.messages.create(
      emailConfig.mailgun.domain,
      messageData
    );
  }

  private async sendViaSMTP(options: EmailOptions): Promise<void> {
    await this.transporter.sendMail({
      from: `${emailConfig.fromName} <${emailConfig.from}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
  }

  async sendVerificationEmail(
    to: string,
    otp: string,
    name: string
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .otp-box { background-color: white; border: 2px solid #4F46E5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Email Verification</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>Thank you for registering with BillPadi! Please use the OTP below to verify your email address:</p>
              <div class="otp-box">${otp}</div>
              <p>This OTP will expire in 10 minutes.</p>
              <p>If you didn't request this verification, please ignore this email.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} BillPadi. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: "Verify Your Email - BillPadi",
      html,
      text: `Hello ${name}, Your verification OTP is: ${otp}. This OTP will expire in 10 minutes.`,
    });
  }
  async sendForgotPasswordEmail(
    to: string,
    otp: string,
    name: string
  ): Promise<void> {
    const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
          .content { background-color: #f9f9f9; padding: 30px; }
          .otp-box { background-color: white; border: 2px solid #4F46E5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hello ${name},</p>
            <p>We received a request to reset your BillPadi account password. Please use the OTP below to proceed with resetting your password:</p>
            <div class="otp-box">${otp}</div>
            <p>This OTP will expire in 10 minutes.</p>
            <p>If you did not request a password reset, please ignore this email and your account will remain secure.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} BillPadi. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

    await this.sendEmail({
      to,
      subject: "Reset Your Password - BillPadi",
      html,
      text: `Hello ${name}, Your password reset OTP is: ${otp}. It will expire in 10 minutes. If you did not request a reset, please ignore this email.`,
    });
  }

  async send2FAEmail(to: string, otp: string, name: string): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .otp-box { background-color: white; border: 2px solid #4F46E5; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 20px 0; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Two-Factor Authentication</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>Your 2FA verification code is:</p>
              <div class="otp-box">${otp}</div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you didn't request this code, please secure your account immediately.</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} BillPadi. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.sendEmail({
      to,
      subject: "Your 2FA Code - BillPadi",
      html,
      text: `Hello ${name}, Your 2FA code is: ${otp}. This code will expire in 10 minutes.`,
    });
  }
}
