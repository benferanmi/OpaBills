import mongoose, { Schema, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface ILedger extends Document {
  _id: string;
  ledgerableType: 'User' | 'Wallet';
  ledgerableId: Types.ObjectId;
  source: string;
  destination: string;
  oldBalance: number;
  newBalance: number;
  type: 'debit' | 'credit';
  reason: string;
  amount: number;
  currencyCode: string;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerSchema = new Schema<ILedger>(
  {
    _id: { type: String, default: uuidv4 },
    ledgerableType: { type: String, enum: ['User', 'Wallet'], required: true },
    ledgerableId: { type: Schema.Types.ObjectId, required: true },
    source: { type: String, required: true },
    destination: { type: String, required: true },
    oldBalance: { type: Number, required: true },
    newBalance: { type: Number, required: true },
    type: { type: String, enum: ['debit', 'credit'], required: true },
    reason: { type: String, required: true },
    amount: { type: Number, required: true },
    currencyCode: { type: String, default: 'NGN' },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Indexes
LedgerSchema.index({ ledgerableId: 1 });
LedgerSchema.index({ type: 1 });
LedgerSchema.index({ createdAt: -1 });

export const Ledger = mongoose.model<ILedger>('Ledger', LedgerSchema);
