import { NotificationRepository } from "@/repositories/NotificationRepository";
import { UserRepository } from "@/repositories/UserRepository";
import { EmailService } from "../EmailService";
import { SMSService } from "../SMSService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { PushNotificationService } from "./PushNotificationService";

export interface CreateNotificationDTO {
  type: string;
  notifiableType: "User" | "Admin";
  notifiableId: Types.ObjectId;
  data: any;
  sendEmail?: boolean;
  sendSMS?: boolean;
  sendPush?: boolean;
}

export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;
  private pushNotificationService: PushNotificationService;
  private notificationRepository: NotificationRepository;
  private userRepository: UserRepository;

  constructor() {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
    this.pushNotificationService = new PushNotificationService();
    this.notificationRepository = new NotificationRepository();
    this.userRepository = new UserRepository();
  }

  async createNotification(data: CreateNotificationDTO): Promise<any> {
    const notification = await this.notificationRepository.create(data);

    // Send email if requested
    if (data.sendEmail && data.notifiableType === "User") {
      try {
        const user = await this.userRepository.findById(
          data.notifiableId.toString()
        );
        if (user && user.email) {
          await this.sendNotificationEmail(
            user.email,
            user.firstname,
            data.type,
            data.data
          );
        }
      } catch (error) {
        console.error("Error sending notification email:", error);
      }
    }

    // Send SMS if requested
    if (data.sendSMS && data.notifiableType === "User") {
      try {
        const user = await this.userRepository.findById(
          data.notifiableId.toString()
        );
        if (user && user.phone && user.phoneCode) {
          await this.sendNotificationSMS(
            `${user.phoneCode}${user.phone}`,
            data.type,
            data.data
          );
        }
      } catch (error) {
        console.error("Error sending notification SMS:", error);
      }
    }

    // Send Push Notification if requested
    if (data.sendPush && data.notifiableType === "User") {
      try {
        const user = await this.userRepository.findById(
          data.notifiableId.toString()
        );
        if (user) {
          await this.sendPushNotification(
            data.notifiableId.toString(),
            data.type,
            data.data
          );
        }
      } catch (error) {
        console.error("Error sending push notification:", error);
      }
    }

    return notification;
  }

  private async sendNotificationEmail(
    to: string,
    name: string,
    type: string,
    data: any
  ): Promise<void> {
    let subject = "Notification from BillPadi";
    let message = "";

    switch (type) {
      case "transaction_success":
        subject = "Transaction Successful";
        message = `Your ${data.transactionType} transaction of ₦${data.amount} was successful. Reference: ${data.reference}`;
        break;
      case "transaction_failed":
        subject = "Transaction Failed";
        message = `Your ${data.transactionType} transaction of ₦${data.amount} failed. Please try again.`;
        break;
      case "wallet_credit":
        subject = "Wallet Credited";
        message = `Your wallet has been credited with ₦${data.amount}. New balance: ₦${data.balance}`;
        break;
      case "wallet_debit":
        subject = "Wallet Debited";
        message = `Your wallet has been debited with ₦${data.amount}. New balance: ₦${data.balance}`;
        break;
      case "withdrawal_approved":
        subject = "Withdrawal Approved";
        message = `Your withdrawal of ₦${data.amount.toLocaleString()} has been approved and is being processed. Reference: ${
          data.reference
        }`;
        break;
      case "withdrawal_declined":
        subject = "Withdrawal Declined";
        message = `Your withdrawal of ₦${data.amount.toLocaleString()} was declined and refunded to your wallet. Reason: ${
          data.reason
        }. New balance: ₦${data.balance.toLocaleString()}`;
        break;
      case "withdrawal_completed":
        subject = "Withdrawal Completed";
        message = `Your withdrawal of ₦${data.amount.toLocaleString()} has been completed successfully. Reference: ${
          data.reference
        }`;
        break;
      case "withdrawal_failed":
        subject = "Withdrawal Failed";
        message = `Your withdrawal of ₦${data.amount.toLocaleString()} failed. ${
          data.refunded ? "The amount has been refunded to your wallet." : ""
        } Reason: ${
          data.failureReason || data.reason || "Unknown error"
        }. Reference: ${data.reference}`;
        break;
      case "withdrawal_reversed":
        subject = "Withdrawal Reversed";
        message = `Your withdrawal of ₦${data.amount.toLocaleString()} has been reversed by the payment provider. ${
          data.refunded ? "The amount has been refunded to your wallet." : ""
        } Reference: ${data.reference}`;
        break;
      default:
        message = data.message || "You have a new notification";
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background-color: #f9f9f9; padding: 30px; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${subject}</h1>
            </div>
            <div class="content">
              <p>Hello ${name},</p>
              <p>${message}</p>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} BillPadi. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    await this.emailService.sendEmail({ to, subject, html, text: message });
  }

  private async sendNotificationSMS(
    to: string,
    type: string,
    data: any
  ): Promise<void> {
    let message = "";

    switch (type) {
      case "transaction_success":
        message = `BillPadi: Your ${data.transactionType} transaction of NGN${data.amount} was successful. Ref: ${data.reference}`;
        break;
      case "transaction_failed":
        message = `BillPadi: Your ${data.transactionType} transaction of NGN${data.amount} failed. Please try again.`;
        break;
      case "wallet_credit":
        message = `BillPadi: Your wallet has been credited with NGN${data.amount}. Balance: NGN${data.balance}`;
        break;
      case "wallet_debit":
        message = `BillPadi: Your wallet has been debited with NGN${data.amount}. Balance: NGN${data.balance}`;
        break;
      case "withdrawal_approved":
        message = `BillPadi: Your withdrawal of NGN${data.amount} has been approved. Ref: ${data.reference}`;
        break;
      case "withdrawal_declined":
        message = `BillPadi: Your withdrawal of NGN${data.amount} was declined and refunded. Reason: ${data.reason}`;
        break;
      case "withdrawal_completed":
        message = `BillPadi: Your withdrawal of NGN${data.amount} has been completed. Ref: ${data.reference}`;
        break;
      case "withdrawal_failed":
        message = `BillPadi: Your withdrawal of NGN${data.amount} failed${
          data.refunded ? " and was refunded" : ""
        }. Ref: ${data.reference}`;
        break;
      case "withdrawal_reversed":
        message = `BillPadi: Your withdrawal of NGN${data.amount} was reversed${
          data.refunded ? " and refunded" : ""
        }. Ref: ${data.reference}`;
        break;
      default:
        message = data.message || "You have a new notification from BillPadi";
    }

    await this.smsService.sendSMS({ to, message });
  }

  private async sendPushNotification(
    userId: string,
    type: string,
    data: any
  ): Promise<void> {
    let title = "BillPadi Notification";
    let body = "";

    switch (type) {
      case "transaction_success":
        title = "Transaction Successful";
        body = `Your ${data.transactionType} transaction of ₦${data.amount} was successful`;
        break;
      case "transaction_failed":
        title = "Transaction Failed";
        body = `Your ${data.transactionType} transaction of ₦${data.amount} failed`;
        break;
      case "wallet_credit":
        title = "Wallet Credited";
        body = `Your wallet has been credited with ₦${data.amount}`;
        break;
      case "wallet_debit":
        title = "Wallet Debited";
        body = `Your wallet has been debited with ₦${data.amount}`;
        break;
      case "withdrawal_approved":
        title = "Withdrawal Approved";
        body = `Your withdrawal of ₦${data.amount} has been approved`;
        break;
      case "withdrawal_declined":
        title = "Withdrawal Declined";
        body = `Your withdrawal of ₦${data.amount} was declined and refunded`;
        break;
      case "withdrawal_completed":
        title = "Withdrawal Completed";
        body = `Your withdrawal of ₦${data.amount} has been completed`;
        break;
      case "withdrawal_failed":
        title = "Withdrawal Failed";
        body = `Your withdrawal of ₦${data.amount} failed${
          data.refunded ? " and was refunded" : ""
        }`;
        break;
      case "withdrawal_reversed":
        title = "Withdrawal Reversed";
        body = `Your withdrawal of ₦${data.amount} was reversed${
          data.refunded ? " and refunded" : ""
        }`;
        break;
      default:
        body = data.message || "You have a new notification";
    }

    await this.pushNotificationService.sendToUser(userId, {
      title,
      body,
      data: {
        type,
        ...data,
      },
    });
  }

  async getUserNotifications(
    userId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<any> {
    const { data, total } =
      await this.notificationRepository.findByNotifiableId(userId, page, limit);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getUnreadNotifications(userId: string): Promise<any> {
    const notifications =
      await this.notificationRepository.findUnreadByNotifiableId(userId);
    return notifications;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.countUnread(userId);
  }

  async markAsRead(notificationId: string): Promise<any> {
    const notification = await this.notificationRepository.markAsRead(
      notificationId
    );
    if (!notification) {
      throw new AppError(
        "Notification not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);
  }

  async getNotificationById(notificationId: string): Promise<any> {
    const notification = await this.notificationRepository.findById(
      notificationId
    );
    if (!notification) {
      throw new AppError(
        "Notification not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return notification;
  }

  async markAsUnread(notificationId: string): Promise<any> {
    const notification = await this.notificationRepository.update(
      notificationId,
      { read: false }
    );
    if (!notification) {
      throw new AppError(
        "Notification not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return notification;
  }

  async deleteNotification(notificationId: string): Promise<void> {
    await this.notificationRepository.softDelete(notificationId);
  }

  async clearAllNotifications(userId: string): Promise<void> {
    await this.notificationRepository.deleteMany(userId);
  }
}
