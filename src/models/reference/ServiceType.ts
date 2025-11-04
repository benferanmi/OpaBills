import mongoose, { Schema, Document } from "mongoose";

export interface IServiceType extends Document {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const ServiceTypeSchema = new Schema<IServiceType>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    icon: {
      type: String,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    displayOrder: {
      type: Number,
      default: 0,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
ServiceTypeSchema.index({ isActive: 1 });
ServiceTypeSchema.index({ displayOrder: 1 });
ServiceTypeSchema.index({ code: 1, isActive: 1 });

export const ServiceType = mongoose.model<IServiceType>(
  "ServiceType",
  ServiceTypeSchema
);
