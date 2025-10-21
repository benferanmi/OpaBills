import mongoose, { Schema, Document } from 'mongoose';

export interface IServiceCharge extends Document {
  name: string;
  code: string;
  details?: string;
  type: 'flat' | 'percentage';
  value: number;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceChargeSchema = new Schema<IServiceCharge>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    details: { type: String },
    type: { type: String, enum: ['flat', 'percentage'], required: true },
    value: { type: Number, required: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
ServiceChargeSchema.index({ code: 1 });
ServiceChargeSchema.index({ type: 1 });

export const ServiceCharge = mongoose.model<IServiceCharge>('ServiceCharge', ServiceChargeSchema);
