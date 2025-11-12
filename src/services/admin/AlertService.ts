import { AlertRepository } from "@/repositories/admin/AlertRepository";
import { NotificationService } from "@/services/client/NotificationService";
import { UserRepository } from "@/repositories/UserRepository";

export class AlertService {
  private alertRepository: AlertRepository;
  private notificationService: NotificationService;
  private userRepository: UserRepository;

  constructor() {
    this.alertRepository = new AlertRepository();
    this.notificationService = new NotificationService();
    this.userRepository = new UserRepository();
  }

  async listAlerts(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = { deletedAt: null };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    const result = await this.alertRepository.findWithPagination(
      query,
      page,
      limit
    );

    return {
      alerts: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createAlert(data: any) {
    const alert = await this.alertRepository.create(data);
    return { message: "Alert created successfully", alert };
  }

  async getAlertDetails(alertId: string) {
    const alert = await this.alertRepository.findById(alertId);
    if (!alert || alert.deletedAt) {
      throw new Error("Alert not found");
    }
    return alert;
  }

  async updateAlert(alertId: string, data: any) {
    const alert = await this.alertRepository.findById(alertId);
    if (!alert || alert.deletedAt) {
      throw new Error("Alert not found");
    }

    Object.assign(alert, data);
    await alert.save();

    return { message: "Alert updated successfully", alert };
  }

  async deleteAlert(alertId: string) {
    const alert = await this.alertRepository.findById(alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    alert.deletedAt = new Date();
    await alert.save();

    return { message: "Alert deleted successfully" };
  }

  async restoreAlert(alertId: string) {
    const alert = await this.alertRepository.findById(alertId);
    if (!alert) {
      throw new Error("Alert not found");
    }

    alert.deletedAt = null;
    await alert.save();

    return { message: "Alert restored successfully" };
  }

  async dispatchAlert(alertId: string) {
    const alert = await this.alertRepository.findById(alertId);
    if (!alert || alert.deletedAt) {
      throw new Error("Alert not found");
    }

    // Get all active users
    const users = await this.userRepository.find({ status: "active" });

    // Create notifications for all users
    const notifications = users.map((user) => ({
      notifiableType: "User" as "User" | "Admin",
      notifiableId: user.id,
      type: "info",
      data: {
        title: alert.title,
        message: alert.body,
      },
      sendEmail: false,
      sendSMS: false,
      sendPush: true, // Default to push
    }));

    await Promise.all(
      notifications.map((notification) =>
        this.notificationService.createNotification(notification)
      )
    );

    alert.status = "sent";
    alert.dispatchedAt = new Date();
    await alert.save();

    return {
      message: "Alert dispatched successfully",
      recipientCount: users.length,
    };
  }
}
