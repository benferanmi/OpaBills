import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICrypto extends Document {
  providerId: Types.ObjectId;
  assetId: string; // UUID - external ID
  name: string;
  code: string;
  icon?: string;
  sellRate?: number;
  buyRate?: number;
  sellMinAmount?: number;
  sellMaxAmount?: number;
  buyMinAmount?: number;
  buyMaxAmount?: number;
  saleTerm?: string;
  purchaseTerm?: string;
  saleActivated: boolean;
  purchaseActivated: boolean;
  networks?: any[]; // Array of network objects
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const cryptoSchema = new Schema<ICrypto>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
      index: true,
    },
    assetId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      index: true,
    },
    icon: String,
    sellRate: Number,
    buyRate: Number,
    sellMinAmount: Number,
    sellMaxAmount: Number,
    buyMinAmount: Number,
    buyMaxAmount: Number,
    saleTerm: String,
    purchaseTerm: String,
    saleActivated: {
      type: Boolean,
      default: false,
      index: true,
    },
    purchaseActivated: {
      type: Boolean,
      default: false,
      index: true,
    },
    networks: [Schema.Types.Mixed],
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

export const Crypto = mongoose.model<ICrypto>('Crypto', cryptoSchema);
