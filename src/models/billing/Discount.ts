import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDiscount extends Document {
  providerId: Types.ObjectId;
  serviceId: Types.ObjectId;
  name: string;
  code: string;
  type: 'flat' | 'percentage';
  value: number;
  productType: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DiscountSchema = new Schema<IDiscount>(
  {
    providerId: { type: Schema.Types.ObjectId, ref: 'Provider', required: true },
    serviceId: { type: Schema.Types.ObjectId, ref: 'Service', required: true },
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    type: { type: String, enum: ['flat', 'percentage'], required: true },
    value: { type: Number, required: true },
    productType: { type: String, required: true },
    active: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
DiscountSchema.index({ providerId: 1 });
DiscountSchema.index({ serviceId: 1 });
DiscountSchema.index({ active: 1 });
DiscountSchema.index({ productType: 1 });

export const Discount = mongoose.model<IDiscount>('Discount', DiscountSchema);
