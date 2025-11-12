import admin from "firebase-admin";
import { UserRepository } from "@/repositories/UserRepository";

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
}

export class PushNotificationService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  /**
   * Send push notification to a specific user (all their devices)
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<void> {
    try {
      const user = await this.userRepository.findById(userId);

      if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
        console.log(`No FCM tokens found for user: ${userId}`);
        return;
      }

      await this.sendToTokens(userId, user.fcmTokens, payload);
    } catch (error) {
      console.error(
        `Error sending push notification to user ${userId}:`,
        error
      );
      // Don't throw - notification failure shouldn't break the main flow
    }
  }

  /**
   * Send push notification to specific device tokens
   */
  private async sendToTokens(
    userId: string,
    tokens: string[],
    payload: PushNotificationPayload
  ): Promise<void> {
    if (!tokens || tokens.length === 0) {
      return;
    }

    try {
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
        },
        data: payload.data || {},
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "billpadi_notifications",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);

      console.log(
        `Push notification sent: ${response.successCount}/${tokens.length} successful`
      );

      // Remove invalid tokens
      if (response.failureCount > 0) {
        const invalidTokens: string[] = [];

        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const errorCode = resp.error?.code;

            // These error codes mean the token is no longer valid
            if (
              errorCode === "messaging/invalid-registration-token" ||
              errorCode === "messaging/registration-token-not-registered"
            ) {
              invalidTokens.push(tokens[idx]);
            }
          }
        });

        // Remove invalid tokens from user's fcmTokens array
        if (invalidTokens.length > 0) {
          const user = await this.userRepository.findById(userId);
          if (user) {
            user.fcmTokens = user.fcmTokens.filter(
              (token) => !invalidTokens.includes(token)
            );
            await user.save();
            console.log(`Removed ${invalidTokens.length} invalid FCM tokens`);
          }
        }
      }
    } catch (error) {
      console.error("Error sending push notifications:", error);
    }
  }

  /**
   * Send push notification to a topic (for broadcast messages)
   * Use this for announcements to all users
   */
  async sendToTopic(
    topic: string,
    payload: PushNotificationPayload
  ): Promise<void> {
    try {
      const message: admin.messaging.Message = {
        topic,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { imageUrl: payload.imageUrl }),
        },
        data: payload.data || {},
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "billpadi_notifications",
          },
        },
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().send(message);
      console.log(`Successfully sent message to topic ${topic}:`, response);
    } catch (error) {
      console.error(
        `Error sending push notification to topic ${topic}:`,
        error
      );
    }
  }

  /**
   * Send to multiple users at once
   */
  async sendToMultipleUsers(
    userIds: string[],
    payload: PushNotificationPayload
  ): Promise<void> {
    const promises = userIds.map((userId) => this.sendToUser(userId, payload));
    await Promise.allSettled(promises);
  }
}
