import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPayment extends Document {
  userId: Types.ObjectId;
  reference: string;
  providerReference?: string;
  providerTransactionId?: string;
  amount: number;
  amountPaid?: number;
  status: "pending" | "success" | "failed" | "expired" | "processing" | "reversed";
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

    // For withdrawals
    accountNumber?: string;
    accountName?: string;
    bankCode?: string;
    bankName?: string;
    withdrawalRequestId?: string;
    transferId?: string;
    transferStatus?: string;
    providerReference?: string;
    provider?: "monnify" | "saveHaven" | "flutterwave";
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
    providerReference: { type: String, index: true },
    providerTransactionId: { type: String, unique: true, sparse: true },
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
PaymentSchema.index({ "meta.provider": 1 });
PaymentSchema.index({ providerTransactionId: 1, 'meta.provider': 1 }, { 
  unique: true, 
  sparse: true,
  name: 'providerTransactionUnique' 
});

export const Payment = mongoose.model<IPayment>("Payment", PaymentSchema);
