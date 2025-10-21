import mongoose, { Schema, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ITransaction extends Document {
  _id: string;
  walletId?: Types.ObjectId;
  sourceId?: Types.ObjectId;
  recipientId?: Types.ObjectId;
  transactableType?: string;
  transactableId?: Types.ObjectId;
  reference: string;
  providerReference?: string;
  amount: number;
  type: string;
  provider: string;
  remark?: string;
  purpose?: string;
  status: 'pending' | 'success' | 'failed' | 'reversed';
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    _id: { type: String, default: uuidv4 },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet' },
    sourceId: { type: Schema.Types.ObjectId, ref: 'User' },
    recipientId: { type: Schema.Types.ObjectId, ref: 'User' },
    transactableType: { type: String },
    transactableId: { type: Schema.Types.ObjectId },
    reference: { type: String, required: true, unique: true },
    providerReference: { type: String },
    amount: { type: Number, required: true },
    type: { type: String, required: true },
    provider: { type: String, required: true },
    remark: { type: String },
    purpose: { type: String },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'reversed'],
      default: 'pending',
    },
    meta: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Indexes
TransactionSchema.index({ walletId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', TransactionSchema);
