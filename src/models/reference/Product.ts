import mongoose, { Schema, Document, Types } from "mongoose";

export interface IProduct extends Document {
  serviceId: Types.ObjectId;
  providerId: Types.ObjectId;
  type:
    | "data"
    | "airtime"
    | "internationalData"
    | "internationalAirtime"
    | "betting"
    | "education"
    | "electricity"
    | "flight"
    | "tv"
    | "crypto"
    | "giftcard";
  name: string;
  code: string;
  amount: number;
  validity?: string;
  description?: string;

  attributes?: {
    dataType?:
      | "SME"
      | "GIFTING"
      | "DIRECT"
      | "AWOOF DATA"
      | "CORPORATE GIFTING"
      | "DIRECT COUPON"
      | "PACKAGE";
    validityPeriod?: "daily" | "weekly" | "monthly" | "yearly" | string;

    // For electricity
    discoName?: string;
    meterType?: "prepaid" | "postpaid";

    // For TV
    bouquetType?: string;
    decoderType?: string;

    // For betting
    minimumStake?: number;

    // For education
    examType?: string;

    // Allow any other flexible attributes
    [key: string]: any;
  };

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
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    name: { type: String, required: true },
    code: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: [
        "data",
        "airtime",
        "internationalData",
        "internationalAirtime",
        "betting",
        "education",
        "electricity",
        "flight",
        "tv",
        "crypto",
        "giftcard",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    validity: { type: String },
    description: { type: String },

    // Flexible attributes field
    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },

    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

// Indexes
ProductSchema.index({ serviceId: 1 });
ProductSchema.index({ providerId: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ serviceId: 1, isActive: 1 });
ProductSchema.index({ type: 1, isActive: 1 });

// Indexes for filtering by attributes
ProductSchema.index({ type: 1, "attributes.dataType": 1 });
ProductSchema.index({ type: 1, "attributes.validityPeriod": 1 });
ProductSchema.index({ type: 1, isActive: 1, "attributes.validityPeriod": 1 });
ProductSchema.index({ "attributes.meterType": 1 });

export const Product = mongoose.model<IProduct>("Product", ProductSchema);
