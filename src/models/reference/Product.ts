import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IProduct extends Document {
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  name: string;
  serviceCode: string;
  code?: string;
  type: string;
  productType?: string;
  dataType?: 'SME' | 'GIFTING' | 'DIRECT' | 'AWOOF DATA' | 'CORPORATE GIFTING' | 'DIRECT COUPON';
  amount: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    name: { type: String, required: true },
    serviceCode: { type: String, required: true },
    code: { type: String },
    type: { type: String, required: true },
    productType: { type: String },
    dataType: {
      type: String,
      enum: ['SME', 'GIFTING', 'DIRECT', 'AWOOF DATA', 'CORPORATE GIFTING', 'DIRECT COUPON'],
    },
    amount: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProductSchema.index({ providerId: 1 });
ProductSchema.index({ serviceId: 1 });
ProductSchema.index({ active: 1 });
ProductSchema.index({ productType: 1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);
