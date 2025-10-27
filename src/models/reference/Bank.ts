import mongoose, { Schema, Document } from "mongoose";

export interface IBank extends Document {
  name: string;
  shortName?: string;
  paystackCode?: string;
  flutterwaveCode?: string;
  monnifyCode?: string;
  savehavenCode?: string;
  universalCode?: string; // optional fallback code
  icon?: string;
  country?: string;
  currency?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const BankSchema = new Schema<IBank>(
  {
    name: { type: String, required: true },
    shortName: { type: String },
    paystackCode: { type: String },
    flutterwaveCode: { type: String },
    monnifyCode: { type: String },
    savehavenCode: { type: String },
    universalCode: { type: String },
    icon: { type: String },
    country: { type: String, default: "Nigeria" },
    currency: { type: String, default: "NGN" },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Indexes for performance
BankSchema.index({ name: 1 });
BankSchema.index({ paystackCode: 1 });
BankSchema.index({ flutterwaveCode: 1 });
BankSchema.index({ monnifyCode: 1 });
BankSchema.index({ savehavenCode: 1 });

export const Bank = mongoose.model<IBank>("Bank", BankSchema);
