import mongoose, { Schema, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IGiftCardTransaction extends Document {
  _id: string;
  giftCardType?: string;
  giftCardId?: Types.ObjectId;
  userId: Types.ObjectId;
  parentId?: string;
  transactionId?: string;
  reference: string;
  tradeType: 'buy' | 'sell';
  cardType?: string;
  card?: string;
  pin?: string;
  comment?: string;
  amount: number;
  quantity: number;
  serviceCharge?: number;
  rate?: number;
  payableAmount?: number;
  groupTag?: string;
  status: 'pending' | 'success' | 'failed' | 'approved' | 'declined';
  preorder: boolean;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  reviewNote?: string;
  reviewRate?: number;
  reviewAmount?: number;
  reviewProof?: string;
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
}

const GiftCardTransactionSchema = new Schema<IGiftCardTransaction>(
  {
    _id: { type: String, default: uuidv4 },
    giftCardType: { type: String },
    giftCardId: { type: Schema.Types.ObjectId, ref: 'GiftCard' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    parentId: { type: String },
    transactionId: { type: String },
    reference: { type: String, required: true, unique: true },
    tradeType: { type: String, enum: ['buy', 'sell'], required: true },
    cardType: { type: String },
    card: { type: String },
    pin: { type: String },
    comment: { type: String },
    amount: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    serviceCharge: { type: Number, default: 0 },
    rate: { type: Number },
    payableAmount: { type: Number },
    groupTag: { type: String },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'approved', 'declined'],
      default: 'pending',
    },
    preorder: { type: Boolean, default: false },
    bankName: { type: String },
    accountName: { type: String },
    accountNumber: { type: String },
    reviewNote: { type: String },
    reviewRate: { type: Number },
    reviewAmount: { type: Number },
    reviewProof: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Indexes
GiftCardTransactionSchema.index({ status: 1 });
GiftCardTransactionSchema.index({ tradeType: 1 });
GiftCardTransactionSchema.index({ groupTag: 1 });

export const GiftCardTransaction = mongoose.model<IGiftCardTransaction>(
  'GiftCardTransaction',
  GiftCardTransactionSchema
);
