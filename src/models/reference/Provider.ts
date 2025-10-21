import mongoose, { Schema, Document } from 'mongoose';

export interface IProvider extends Document {
  name: string;
  shortName: string;
  logo?: string;
  active: boolean;
  productType?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const ProviderSchema = new Schema<IProvider>(
  {
    name: { type: String, required: true },
    shortName: { type: String, required: true, unique: true },
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
ProviderSchema.index({ active: 1 });
ProviderSchema.index({ productType: 1 });

export const Provider = mongoose.model<IProvider>('Provider', ProviderSchema);
