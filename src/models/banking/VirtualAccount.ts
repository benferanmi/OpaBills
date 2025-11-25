import mongoose, { Schema, Document, Types } from "mongoose";

export interface IVirtualAccount extends Document {
  _id: string; // UUID
  userId: Types.ObjectId;
  provider: string;
  bankCode?: string;
  bankName: string;
  customerName?: string;
  accountName?: string;
  accountNumber: string;
  accountReference?: string;
  isPrimary?: boolean;
  isActive?: boolean;
  orderReference?: string;
  type: "permanent" | "temporary";
  expiredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const virtualAccountSchema = new Schema<IVirtualAccount>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    provider: {
      type: String,
      required: true,
      index: true,
    },
    bankCode: String,
    bankName: {
      type: String,
      required: true,
    },
    customerName: String,
    accountName: String,
    accountNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    accountReference: String,
    orderReference: String,
    isPrimary: { type: Boolean },
    isActive: { type: Boolean },
    type: {
      type: String,
      enum: ["permanent", "temporary"],
      required: true,
      index: true,
    },
    expiredAt: Date,
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

export const VirtualAccount = mongoose.model<IVirtualAccount>(
  "VirtualAccount",
  virtualAccountSchema
);
