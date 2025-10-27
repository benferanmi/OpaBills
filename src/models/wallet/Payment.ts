import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPayment extends Document {
  userId: Types.ObjectId;
  reference: string;
  amount: number;
  amountPaid?: number;
  status: "pending" | "success" | "failed" | "expired";
  meta: {
    virtualAccount?: {
      accountNumber: string;
      bankName: string;
      accountName: string;
      provider: string;
      expiresAt?: Date;
      orderReference?: string;
      providerReference?: string;
    };
    provider?: string;
    verificationData?: any;
    [key: string]: any;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reference: { type: String, required: true, unique: true },
    amount: { type: Number, required: true },
    amountPaid: { type: Number },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
    },
    meta: { type: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
  }
);

// Indexes
PaymentSchema.index({ userId: 1 });
PaymentSchema.index({ status: 1 });
PaymentSchema.index({ createdAt: -1 });

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
