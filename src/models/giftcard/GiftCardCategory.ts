import mongoose, { Schema, Document, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IGiftCardCategory extends Document {
  providerId: Types.ObjectId;
  categoryId: string;
  name: string;
  icon?: string;

  transactionType: "buy" | "sell" | "both";

  saleTerm?: string;
  purchaseTerm?: string;
  saleActivated: boolean;
  purchaseActivated: boolean;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const GiftCardCategorySchema = new Schema<IGiftCardCategory>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      required: true,
    },
    categoryId: { type: String, default: uuidv4, unique: true },
    name: { type: String, required: true },
    icon: { type: String },

    transactionType: {
      type: String,
      enum: ["buy", "sell", "both"],
      required: true,
    },

    saleTerm: { type: String },
    purchaseTerm: { type: String },
    saleActivated: { type: Boolean, default: false },
    purchaseActivated: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
GiftCardCategorySchema.index({ providerId: 1 });
GiftCardCategorySchema.index({ status: 1 });
GiftCardCategorySchema.index({ transactionType: 1 });

export const GiftCardCategory = mongoose.model<IGiftCardCategory>(
  "GiftCardCategory",
  GiftCardCategorySchema
);
