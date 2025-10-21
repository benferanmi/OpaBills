import { NotificationRepository } from '@/repositories/NotificationRepository';
import { UserRepository } from '@/repositories/UserRepository';
import { EmailService } from '../EmailService';
import { SMSService } from '../SMSService';
import { AppError } from '@/middlewares/errorHandler';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

export interface CreateNotificationDTO {
  type: string;
  notifiableType: 'User' | 'Admin';
  notifiableId: string;
  data: any;
  sendEmail?: boolean;
  sendSMS?: boolean;
}

export class NotificationService {
  private emailService: EmailService;
  private smsService: SMSService;

  constructor(
    private notificationRepository: NotificationRepository,
    private userRepository: UserRepository
  ) {
    this.emailService = new EmailService();
    this.smsService = new SMSService();
  }

  async createNotification(data: CreateNotificationDTO): Promise<any> {
    const notification = await this.notificationRepository.create(data);

    // Send email if requested
    if (data.sendEmail && data.notifiableType === 'User') {
      try {
        const user = await this.userRepository.findById(data.notifiableId);
        if (user && user.email) {
          await this.sendNotificationEmail(user.email, user.firstname, data.type, data.data);
        }
      } catch (error) {
        console.error('Error sending notification email:', error);
      }
    }

    // Send SMS if requested
    if (data.sendSMS && data.notifiableType === 'User') {
      try {
        const user = await this.userRepository.findById(data.notifiableId);
        if (user && user.phone && user.phoneCode) {
          await this.sendNotificationSMS(`${user.phoneCode}${user.phone}`, data.type, data.data);
        }
      } catch (error) {
        console.error('Error sending notification SMS:', error);
      }
    }

    return notification;
  }

  private async sendNotificationEmail(to: string, name: string, type: string, data: any): Promise<void> {
    let subject = 'Notification from BillPadi';
    let message = '';

    switch (type) {
      case 'transaction_success':
        subject = 'Transaction Successful';
        message = `Your ${data.transactionType} transaction of ₦${data.amount} was successful. Reference: ${data.reference}`;
        break;
      case 'transaction_failed':
        subject = 'Transaction Failed';
        message = `Your ${data.transactionType} transaction of ₦${data.amount} failed. Please try again.`;
        break;
      case 'wallet_credit':
        subject = 'Wallet Credited';
        message = `Your wallet has been credited with ₦${data.amount}. New balance: ₦${data.balance}`;
        break;
      case 'wallet_debit':
        subject = 'Wallet Debited';
        message = `Your wallet has been debited with ₦${data.amount}. New balance: ₦${data.balance}`;
        break;
      default:
        message = data.message || 'You have a new notification';
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

  private async sendNotificationSMS(to: string, type: string, data: any): Promise<void> {
    let message = '';

    switch (type) {
      case 'transaction_success':
        message = `BillPadi: Your ${data.transactionType} transaction of NGN${data.amount} was successful. Ref: ${data.reference}`;
        break;
      case 'transaction_failed':
        message = `BillPadi: Your ${data.transactionType} transaction of NGN${data.amount} failed. Please try again.`;
        break;
      case 'wallet_credit':
        message = `BillPadi: Your wallet has been credited with NGN${data.amount}. Balance: NGN${data.balance}`;
        break;
      case 'wallet_debit':
        message = `BillPadi: Your wallet has been debited with NGN${data.amount}. Balance: NGN${data.balance}`;
        break;
      default:
        message = data.message || 'You have a new notification from BillPadi';
    }

    await this.smsService.sendSMS({ to, message });
  }

  async getUserNotifications(userId: string, page: number = 1, limit: number = 10): Promise<any> {
    const { data, total } = await this.notificationRepository.findByNotifiableId(userId, page, limit);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async getUnreadNotifications(userId: string): Promise<any> {
    const notifications = await this.notificationRepository.findUnreadByNotifiableId(userId);
    return notifications;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return await this.notificationRepository.countUnread(userId);
  }

  async markAsRead(notificationId: string): Promise<any> {
    const notification = await this.notificationRepository.markAsRead(notificationId);
    if (!notification) {
      throw new AppError('Notification not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }
    return notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.markAllAsRead(userId);
  }
}
