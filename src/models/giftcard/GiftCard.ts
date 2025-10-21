import mongoose, { Schema, Document, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

export interface IGiftCard extends Document {
  countryId?: Types.ObjectId;
  categoryId: Types.ObjectId;
  productId: string;
  name: string;
  sellRate?: number;
  buyRate?: number;
  sellMinAmount?: number;
  sellMaxAmount?: number;
  buyMinAmount?: number;
  buyMaxAmount?: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const GiftCardSchema = new Schema<IGiftCard>(
  {
    countryId: { type: Schema.Types.ObjectId, ref: 'Country' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'GiftCardCategory', required: true },
    productId: { type: String, default: uuidv4, unique: true },
    name: { type: String, required: true },
    sellRate: { type: Number },
    buyRate: { type: Number },
    sellMinAmount: { type: Number },
    sellMaxAmount: { type: Number },
    buyMinAmount: { type: Number },
    buyMaxAmount: { type: Number },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
GiftCardSchema.index({ countryId: 1 });
GiftCardSchema.index({ status: 1 });

export const GiftCard = mongoose.model<IGiftCard>('GiftCard', GiftCardSchema);
