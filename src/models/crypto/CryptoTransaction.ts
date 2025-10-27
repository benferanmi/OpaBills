import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICryptoTransaction extends Document {
  cryptoId: Types.ObjectId;
  userId: Types.ObjectId;
  transactionId?: string; // UUID
  reference: string;
  tradeType: 'buy' | 'sell';
  walletAddress?: string;
  comment?: string;
  amount: number;
  serviceCharge?: number;
  rate?: number;
  payableAmount?: number;
  status: 'pending' | 'success' | 'failed' | 'approved' | 'declined';
  bankName?: string;
  bankCode?: string;
  accountName?: string;
  accountNumber?: string;
  proof?: string;
  reviewNote?: string;
  reviewRate?: number;
  reviewAmount?: number;
  reviewProof?: string;
  network?: any;
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
}

const cryptoTransactionSchema = new Schema<ICryptoTransaction>(
  {
    cryptoId: {
      type: Schema.Types.ObjectId,
      ref: 'Crypto',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    transactionId: String,
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tradeType: {
      type: String,
      enum: ['buy', 'sell'],
      required: true,
      index: true,
    },
    walletAddress: String,
    comment: String,
    amount: {
      type: Number,
      required: true,
    },
    serviceCharge: Number,
    rate: Number,
    payableAmount: Number,
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'approved', 'declined'],
      default: 'pending',
      index: true,
    },
    bankName: String,
    bankCode: String,
    accountName: String,
    accountNumber: String,
    proof: String,
    reviewNote: String,
    reviewRate: Number,
    reviewAmount: Number,
    reviewProof: String,
    network: Schema.Types.Mixed,
    meta: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

export const CryptoTransaction = mongoose.model<ICryptoTransaction>('CryptoTransaction', cryptoTransactionSchema);
