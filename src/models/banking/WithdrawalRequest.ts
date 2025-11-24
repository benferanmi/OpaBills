import mongoose, { Schema, Document, Types } from "mongoose";

export interface IWithdrawalRequest extends Document {
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  reference: string;
  provider: "monnify" | "saveHaven" | "flutterwave";
  amount: number;
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  bankCode?: string;
  status: "pending" | "reversed" | "approved" | "declined" | "completed" | "failed" | "processing";
  type: string;
  proof?: string;
  reviewProof?: string;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId | string;
  declinedAt?: Date;
  declinedBy?: Types.ObjectId | string;
  declineReason?: string;
  processedAt?: Date;
  providerReference?: string;
  meta?: any;
  paymentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const withdrawalRequestSchema = new Schema<IWithdrawalRequest>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    walletId: {
      type: Schema.Types.ObjectId,
      ref: "Wallet",
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
      enum: ["pending", "approved", "declined", "completed"],
      default: "pending",
      index: true,
    },
    type: {
      type: String,
      required: true,
    },
    proof: String,
    reviewProof: String,
    approvedAt: Date,
    approvedBy: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
    },
    declinedAt: Date,
    declinedBy: {
      type: Schema.Types.Mixed, // Can be ObjectId or string
    },
    paymentId: {
      type: Schema.Types.ObjectId,
      ref: "Payment",
      index: true,
    },
    declineReason: String,
    processedAt: Date,
    providerReference: String,
    meta: Schema.Types.Mixed,
  },
  {
    timestamps: true,
  }
);

// Add indexes for admin queries
withdrawalRequestSchema.index({ status: 1, createdAt: -1 });
withdrawalRequestSchema.index({ amount: 1 });
withdrawalRequestSchema.index({ userId: 1, status: 1 });

export const WithdrawalRequest = mongoose.model<IWithdrawalRequest>(
  "WithdrawalRequest",
  withdrawalRequestSchema
);
