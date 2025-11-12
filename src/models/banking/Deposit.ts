import mongoose, { Schema, Document, Types } from "mongoose";

export interface IDeposit extends Document {
  _id: string;
  userId: Types.ObjectId;
  walletId: Types.ObjectId;
  reference: string;
  provider: string;
  amount: number;
  status: "pending" | "success" | "failed" | "approved" | "declined";
  approvedAt?: Date;
  approvedBy?: string;
  declinedAt?: Date;
  declinedBy?: string;
  declineReason?: string;
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
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "success", "failed", "approved", "declined"],
      default: "pending",
      index: true,
    },
    approvedAt: {
      type: Date,
    },
    approvedBy: {
      type: String,
    },
    declinedAt: {
      type: Date,
    },
    declinedBy: {
      type: String,
    },
    declineReason: {
      type: String,
    },
    meta: Schema.Types.Mixed,
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Indexes
depositSchema.index({ status: 1, createdAt: -1 });
depositSchema.index({ userId: 1, status: 1 });

export const Deposit = mongoose.model<IDeposit>("Deposit", depositSchema);
