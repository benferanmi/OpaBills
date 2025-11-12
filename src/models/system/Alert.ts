import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAlert extends Document {
  creatorId: Types.ObjectId;
  title: string;
  body: string;
  status: 'pending' | 'sent' | 'failed';
  target: string;
  userCount?: number;
  dispatchedAt?: Date;
  channels?: string[];
  failedNote?: string;
  users?: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

const alertSchema = new Schema<IAlert>(
  {
    creatorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    body: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
      index: true,
    },
    target: {
      type: String,
      required: true,
      index: true,
    },
    userCount: Number,
    dispatchedAt: {
      type: Date,
      index: true,
    },
    channels: [String],
    failedNote: String,
    users: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
