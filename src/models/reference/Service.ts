import mongoose, { Schema, Document } from 'mongoose';

export interface IService extends Document {
  name: string;
  code: string;
  logo?: string;
  active: boolean;
  productType?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    logo: { type: String },
    active: { type: Boolean, default: true },
    productType: { type: String },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
ServiceSchema.index({ active: 1 });
ServiceSchema.index({ productType: 1 });

export const Service = mongoose.model<IService>('Service', ServiceSchema);
