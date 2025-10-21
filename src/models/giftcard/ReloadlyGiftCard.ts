import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReloadlyGiftCard extends Document {
  countryId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  productId: number;
  name: string;
  logo?: string;
  denominationType: 'FIXED' | 'RANGE';
  currency?: string;
  senderFee?: number;
  minAmount?: number;
  maxAmount?: number;
  minAmountNgn?: number;
  maxAmountNgn?: number;
  priceList?: any[];
  ngnPriceList?: any[];
  mappedPriceList?: any[];
  preorder: boolean;
  status: 'active' | 'inactive';
  meta?: any;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const ReloadlyGiftCardSchema = new Schema<IReloadlyGiftCard>(
  {
    countryId: { type: Schema.Types.ObjectId, ref: 'Country' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'ReloadlyCategory' },
    productId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    logo: { type: String },
    denominationType: { type: String, enum: ['FIXED', 'RANGE'], required: true },
    currency: { type: String },
    senderFee: { type: Number },
    minAmount: { type: Number },
    maxAmount: { type: Number },
    minAmountNgn: { type: Number },
    maxAmountNgn: { type: Number },
    priceList: { type: [Schema.Types.Mixed] },
    ngnPriceList: { type: [Schema.Types.Mixed] },
    mappedPriceList: { type: [Schema.Types.Mixed] },
    preorder: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    meta: { type: Schema.Types.Mixed },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReloadlyGiftCardSchema.index({ productId: 1 }, { unique: true });
ReloadlyGiftCardSchema.index({ categoryId: 1 });
ReloadlyGiftCardSchema.index({ countryId: 1 });
ReloadlyGiftCardSchema.index({ status: 1 });
ReloadlyGiftCardSchema.index({ denominationType: 1 });

export const ReloadlyGiftCard = mongoose.model<IReloadlyGiftCard>('ReloadlyGiftCard', ReloadlyGiftCardSchema);
