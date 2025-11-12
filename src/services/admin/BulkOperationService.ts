import { User } from "@/models/core/User";
import { Transaction } from "@/models/wallet/Transaction";
import { NotificationService } from "@/services/client/NotificationService";
import { Types } from "mongoose";

export class BulkOperationService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  async bulkUpdateUserStatus(userIds: string[], status: string) {
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { status } }
    );

    return {
      message: "Bulk user status update completed",
      modifiedCount: result.modifiedCount,
    };
  }

  async bulkSendNotification(userIds: string[], notification: any) {
    const notifications = [];

    for (const userId of userIds) {
      try {
        await this.notificationService.createNotification({
          notifiableType: "User",
          notifiableId: new Types.ObjectId(userId),
          type: notification.type || "info",
          data: {
            title: notification.title,
            message: notification.message,
            ...notification.data, // Any additional data
          },
          sendEmail: notification.sendEmail || false,
          sendSMS: notification.sendSMS || false,
          sendPush: notification.sendPush || true, // Default to push notifications
        });
        notifications.push({ userId, status: "sent" });
      } catch (error) {
        // Fix 1: Type guard for error
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        notifications.push({ userId, status: "failed", error: errorMessage });
      }
    }

    const successCount = notifications.filter(
      (n) => n.status === "sent"
    ).length;
    const failedCount = notifications.filter(
      (n) => n.status === "failed"
    ).length;

    return {
      message: "Bulk notification completed",
      total: userIds.length,
      successCount,
      failedCount,
      details: notifications,
    };
  }

  async bulkUpdateTransactionStatus(
    transactionIds: string[],
    status: string,
    adminId: string
  ) {
    const result = await Transaction.updateMany(
      { _id: { $in: transactionIds } },
      {
        $set: {
          status,
          updatedBy: adminId,
        },
      }
    );

    return {
      message: "Bulk transaction status update completed",
      modifiedCount: result.modifiedCount,
    };
  }

  async bulkDeleteUsers(userIds: string[]) {
    // Soft delete by updating status
    const result = await User.updateMany(
      { _id: { $in: userIds } },
      { $set: { status: "deleted", deletedAt: new Date() } }
    );

    return {
      message: "Bulk user deletion completed",
      modifiedCount: result.modifiedCount,
    };
  }

  async exportUsersToCsv(filters: any) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.emailVerified !== undefined) {
      query.emailVerified = filters.emailVerified === "true";
    }

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const users = await User.find(query)
      .select("firstName lastName email phone status emailVerified createdAt")
      .lean();

    const csvHeaders =
      "First Name,Last Name,Email,Phone,Status,Email Verified,Created At\n";
    const csvRows = users
      .map(
        (user) =>
          `${user.firstname},${user.lastname},${user.email},${
            user.phone || ""
          },${user.status},${user.emailVerifiedAt},${user.createdAt}`
      )
      .join("\n");

    return {
      csv: csvHeaders + csvRows,
      totalRecords: users.length,
    };
  }

  async exportTransactionsToCsv(filters: any) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.type) {
      query.type = filters.type;
    }

    if (filters.startDate && filters.endDate) {
      query.createdAt = {
        $gte: new Date(filters.startDate),
        $lte: new Date(filters.endDate),
      };
    }

    const transactions = await Transaction.find(query)
      .populate("userId", "firstName lastName email")
      .select("reference type amount status createdAt")
      .lean();

    // Fix 2: Removed serviceCharge since it doesn't exist in ITransaction
    const csvHeaders = "Reference,User,Email,Type,Amount,Status,Created At\n";
    const csvRows = transactions
      .map((txn) => {
        const user = txn.sourceId as any;
        return `${txn.reference},${user?.firstName} ${user?.lastName},${user?.email},${txn.type},${txn.amount},${txn.status},${txn.createdAt}`;
      })
      .join("\n");

    return {
      csv: csvHeaders + csvRows,
      totalRecords: transactions.length,
    };
  }

  async bulkImportUsers(userData: any[]) {
    const results = [];

    for (const data of userData) {
      try {
        const existingUser = await User.findOne({ email: data.email });
        if (existingUser) {
          results.push({
            email: data.email,
            status: "skipped",
            reason: "User already exists",
          });
          continue;
        }

        const user = await User.create({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          phone: data.phone,
          password: data.password || Math.random().toString(36).slice(-8), // Generate random password
          status: "pending_verification",
        });

        results.push({
          email: data.email,
          status: "created",
          userId: user._id,
        });
      } catch (error) {
        // Fix 1: Type guard for error
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        results.push({
          email: data.email,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    const createdCount = results.filter((r) => r.status === "created").length;
    const skippedCount = results.filter((r) => r.status === "skipped").length;
    const failedCount = results.filter((r) => r.status === "failed").length;

    return {
      message: "Bulk user import completed",
      total: userData.length,
      createdCount,
      skippedCount,
      failedCount,
      details: results,
    };
  }
}
