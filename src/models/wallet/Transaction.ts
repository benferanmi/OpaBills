import mongoose, { Schema, Document, Types } from "mongoose";

export interface ITransaction extends Document {
  walletId?: Types.ObjectId;
  sourceId?: Types.ObjectId;
  recipientId?: Types.ObjectId;
  transactableType?: string;
  transactableId?: Types.ObjectId;
  reference: string;
  providerReference?: string;
  amount: number;
  direction: "DEBIT" | "CREDIT";
  type: string;
  provider?: string;
  remark?: string;
  purpose?: string;
  status: "pending" | "success" | "failed" | "reversed";
  meta?: any;
  polling?: {
    nextPollAt?: Date;
    pollCount: number;
    lastPolledAt?: Date;
    stoppedAt?: Date;
    stopReason?: "completed" | "failed" | "timeout" | "max_attempts";
    providerOrderId?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    walletId: { type: Schema.Types.ObjectId, ref: "Wallet" },
    sourceId: { type: Schema.Types.ObjectId, ref: "User" },
    recipientId: { type: Schema.Types.ObjectId, ref: "User" },
    transactableType: { type: String },
    transactableId: { type: Schema.Types.ObjectId },
    reference: { type: String, required: true, unique: true },
    providerReference: { type: String },
    amount: { type: Number, required: true },
    direction: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: true,
    },
    type: { type: String, required: true },
    provider: { type: String, required: false },
    remark: { type: String },
    purpose: { type: String },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "reversed"],
      default: "pending",
    },
    meta: { type: Schema.Types.Mixed },
    polling: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Indexes
TransactionSchema.index({ walletId: 1 });
TransactionSchema.index({ status: 1 });
TransactionSchema.index({ type: 1 });
TransactionSchema.index({ createdAt: -1 });

export const Transaction = mongoose.model<ITransaction>(
  "Transaction",
  TransactionSchema
);
