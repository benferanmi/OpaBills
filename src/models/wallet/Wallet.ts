import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWallet extends Document {
  userId: Types.ObjectId;
  type: 'main' | 'bonus' | 'commission';
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

const WalletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      enum: ['main', 'bonus', 'commission'],
      required: true,
    },
    balance: { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  }
);

// Compound unique index
WalletSchema.index({ userId: 1, type: 1 }, { unique: true });
WalletSchema.index({ userId: 1 });
WalletSchema.index({ type: 1 });

export const Wallet = mongoose.model<IWallet>('Wallet', WalletSchema);
