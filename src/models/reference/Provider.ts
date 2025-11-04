import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProvider extends Document {
  name: string;
  code: string;
  baseUrl: string;
  apiKey?: string;
  apiSecret?: string;
  publicKey?: string;
  isActive: boolean;
  config?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const ProviderSchema = new Schema<IProvider>(
  {
    name: { type: String, required: true },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    baseUrl: { type: String, required: true },
    apiKey: {
      type: String,
      select: false,
    },
    apiSecret: {
      type: String,
      select: false,
    },
    publicKey: { type: String },
    isActive: { type: Boolean, default: true },
    config: {
      type: Schema.Types.Mixed,
      default: {},
    },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProviderSchema.index({ isActive: 1 });

export const Provider = mongoose.model<IProvider>("Provider", ProviderSchema);
