import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBankAccount extends Document {
  userId: Types.ObjectId;
  bankId: Types.ObjectId;
  accountNumber: string;
  accountName: string;
  recipientCode?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const BankAccountSchema = new Schema<IBankAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    bankId: { type: Schema.Types.ObjectId, ref: 'Bank', required: true },
    accountNumber: { type: String, required: true },
    accountName: { type: String, required: true },
    recipientCode: { type: String },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Compound unique index
BankAccountSchema.index({ userId: 1, accountNumber: 1 }, { unique: true });
BankAccountSchema.index({ userId: 1 });
BankAccountSchema.index({ bankId: 1 });

export const BankAccount = mongoose.model<IBankAccount>('BankAccount', BankAccountSchema);
