import mongoose, { Schema, Document, Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";

export interface IGiftCard extends Document {
  countryId?: Types.ObjectId;
  categoryId: Types.ObjectId;
  productId: string;
  name: string;
  logo: string;

  // Currency & Exchange
  currency?: string;
  senderCurrency?: string;
  exchangeRate?: number;

  // Rates & Fees
  sellRate?: number;
  buyRate?: number;
  senderFee?: number;
  senderFeePercentage?: number;
  discountPercentage?: number;

  type: "buy" | "sell";

  // Denomination Type
  denominationType?: "RANGE" | "FIXED";

  // Range-based denominations (for RANGE type)
  sellMinAmount?: number;
  sellMaxAmount?: number;
  buyMinAmount?: number;
  buyMaxAmount?: number;

  // NGN converted amounts (for RANGE type)
  minAmountNgn?: number;
  maxAmountNgn?: number;

  // Fixed denominations (for FIXED type)
  priceList?: number[]; 
  ngnPriceList?: number[];
  mappedPriceList?: Record<string, number>;

  // Reloadly specific fields
  fixedRecipientDenominations?: number[];
  fixedSenderDenominations?: number[];
  fixedRecipientToSenderDenominationsMap?: Record<string, number>;

  // Redeem instructions
  redeemInstructions?: {
    concise?: string;
    verbose?: string;
  };

  // Additional metadata
  global?: boolean;
  supportsPreOrder?: boolean;

  // Terms & Activation
  saleTerms?: string;
  purchaseTerms?: string;
  saleActivated: boolean;
  purchaseActivated: boolean;

  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const GiftCardSchema = new Schema<IGiftCard>(
  {
    countryId: { type: Schema.Types.ObjectId, ref: "Country" },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "GiftCardCategory",
      required: true,
    },
    productId: { type: String, default: uuidv4, unique: true },
    name: { type: String, required: true },
    logo: { type: String },

    // Currency & Exchange
    currency: { type: String },
    senderCurrency: { type: String },
    exchangeRate: { type: Number },

    type: { type: String, enum: ["buy", "sell"], required: true },

    // Rates & Fees
    sellRate: { type: Number },
    buyRate: { type: Number },
    senderFee: { type: Number },
    senderFeePercentage: { type: Number },
    discountPercentage: { type: Number },

    // Denomination Type
    denominationType: { type: String, enum: ["RANGE", "FIXED"] },

    // Range-based denominations
    sellMinAmount: { type: Number },
    sellMaxAmount: { type: Number },
    buyMinAmount: { type: Number },
    buyMaxAmount: { type: Number },
    minAmountNgn: { type: Number },
    maxAmountNgn: { type: Number },

    // Fixed denominations
    priceList: [{ type: Number }],
    ngnPriceList: [{ type: Number }],
    mappedPriceList: { type: Schema.Types.Mixed },

    // Reloadly specific fields
    fixedRecipientDenominations: [{ type: Number }],
    fixedSenderDenominations: [{ type: Number }],
    fixedRecipientToSenderDenominationsMap: { type: Schema.Types.Mixed },

    // Redeem instructions
    redeemInstructions: {
      concise: { type: String },
      verbose: { type: String },
    },

    // Additional metadata
    global: { type: Boolean },
    supportsPreOrder: { type: Boolean },

    saleTerms: { type: String },
    purchaseTerms: { type: String },
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
GiftCardSchema.index({ countryId: 1 });
GiftCardSchema.index({ categoryId: 1 });
GiftCardSchema.index({ status: 1 });
GiftCardSchema.index({ type: 1 });
GiftCardSchema.index({ categoryId: 1, type: 1 });
GiftCardSchema.index({ denominationType: 1 });
GiftCardSchema.index({ currency: 1 });

export const GiftCard = mongoose.model<IGiftCard>("GiftCard", GiftCardSchema);
