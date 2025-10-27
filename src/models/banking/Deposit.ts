import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDeposit extends Document {
  _id: string; // UUID
  userId: Types.ObjectId;
  reference: string;
  provider: string;
  amount: number;
  status: 'pending' | 'success' | 'failed';
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
}

const depositSchema = new Schema<IDeposit>(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
      index: true,
    },
    meta: Schema.Types.Mixed,
  },
  {
    timestamps: true,
    _id: false,
  }
);

export const Deposit = mongoose.model<IDeposit>('Deposit', depositSchema);
