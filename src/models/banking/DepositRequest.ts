import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDepositRequest extends Document {
  _id: string; // UUID
  userId: Types.ObjectId;
  reference: string;
  provider: string;
  amount: number;
  status: 'pending' | 'approved' | 'declined';
  proof?: string;
  reviewProof?: string;
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
}

const depositRequestSchema = new Schema<IDepositRequest>(
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
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined'],
      default: 'pending',
      index: true,
    },
    proof: String,
    reviewProof: String,
    meta: Schema.Types.Mixed,
  },
  {
    timestamps: true,
    _id: false,
  }
);

export const DepositRequest = mongoose.model<IDepositRequest>('DepositRequest', depositRequestSchema);
