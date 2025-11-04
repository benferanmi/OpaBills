import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProduct extends Document {
  serviceId: Types.ObjectId;
  name: string;
  code: string;
  providerCodes?: {
    vtpass?: string;
    clubkonnect?: string;
    mydataplug?: string;
  };
  dataType?:
    | "SME"
    | "GIFTING"
    | "DIRECT"
    | "AWOOF DATA"
    | "CORPORATE GIFTING"
    | "DIRECT COUPON"
    | "PACKAGE";
  amount: number;
  validity?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    serviceId: {
      type: Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    name: { type: String, required: true },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    providerCodes: {
      vtpass: { type: String },
      clubkonnect: { type: String },
      mydataplug: { type: String },
    },
    dataType: {
      type: String,
      enum: [
        "SME",
        "GIFTING",
        "DIRECT",
        "AWOOF DATA",
        "CORPORATE GIFTING",
        "DIRECT COUPON",
        "PACKAGE",
      ],
    },
    amount: { type: Number, required: true },
    validity: { type: String },
    description: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProductSchema.index({ serviceId: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ serviceId: 1, isActive: 1 });

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
