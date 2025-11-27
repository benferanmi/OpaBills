import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  type: string;
  notifiableType: 'User' | 'Admin';
  notifiableId: Types.ObjectId;
  data: any;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    type: { type: String, required: true },
    notifiableType: { type: String, enum: ['User', 'Admin'], required: true },
    notifiableId: { type: Schema.Types.ObjectId, required: true },
    data: { type: Schema.Types.Mixed, required: true },
    readAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
NotificationSchema.index({ notifiableId: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ readAt: 1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);
