import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWithdrawalRequest extends Document {
  _id: string; // UUID
  userId: Types.ObjectId;
  reference: string;
  provider: string;
  amount: number;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  status: 'pending' | 'approved' | 'declined';
  type: string;
  proof?: string;
  reviewProof?: string;
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
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
    accountName: String,
    accountNumber: String,
    bankName: String,
    bankCode: String,
    status: {
      type: String,
      enum: ['pending', 'approved', 'declined'],
      default: 'pending',
      index: true,
    },
    type: {
      String
    },
    proof: String,
    reviewProof: String,
    meta: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>('WithdrawalRequest', withdrawalRequestSchema);
