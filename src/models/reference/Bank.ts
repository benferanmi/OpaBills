import mongoose, { Schema, Document } from 'mongoose';

export interface IBank extends Document {
  name: string;
  code?: string;
  safehavenCode?: string;
  icon?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const BankSchema = new Schema<IBank>(
  {
    name: { type: String, required: true },
    code: { type: String },
    safehavenCode: { type: String },
    icon: { type: String },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
BankSchema.index({ name: 1 });
BankSchema.index({ code: 1 });

export const Bank = mongoose.model<IBank>('Bank', BankSchema);
