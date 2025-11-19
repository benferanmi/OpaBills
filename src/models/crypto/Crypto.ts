import mongoose, { Schema, Document, Types } from "mongoose";

export interface INetwork {
  networkId: string; // 'ethereum', 'tron', 'bsc', 'bitcoin'
  name: string; // 'Ethereum', 'Tron', 'Binance Smart Chain'
  code: string; // 'ERC20', 'TRC20', 'BEP20', 'Native'

  // Deposit/Withdrawal settings per network
  depositEnabled: boolean;
  withdrawalEnabled: boolean;
  minDepositAmount: number;
  maxDepositAmount: number;
  minWithdrawalAmount: number;
  maxWithdrawalAmount: number;

  // Network-specific fees
  networkFee: number; // Estimated blockchain fee (gas/transfer fee)
  confirmationsRequired: number;

  // Validation and utilities
  addressPattern?: string;
  explorerUrl?: string; // 'https://tronscan.org/#/transaction/'

  // Platform wallet for this network (where users send crypto when selling)
  platformDepositAddress?: string; // YOUR wallet address for this network
}

export interface ICrypto extends Document {
  providerId?: Types.ObjectId;
  assetId: string; // UUID from provider
  name: string; // 'Tether', 'Bitcoin', 'Ethereum'
  code: string; // 'USDT', 'BTC', 'ETH'
  symbol: string; // 'USDT', 'BTC', 'ETH' (can be same as code)
  icon?: string;
  description?: string;

  // Trading rates (global, but can be overridden per network)
  sellRate?: number; // Rate when user SELLS to platform (platform buys)
  buyRate?: number; // Rate when user BUYS from platform (platform sells)

  // Global limits (can be overridden per network)
  sellMinAmount?: number;
  sellMaxAmount?: number;
  buyMinAmount?: number;
  buyMaxAmount?: number;

  // Terms and conditions
  saleTerm?: string; // Terms for selling
  purchaseTerm?: string; // Terms for buying

  // Feature flags
  saleActivated: boolean; // Can users sell this crypto?
  purchaseActivated: boolean; // Can users buy this crypto?
  isActive: boolean; // Is this crypto available at all?

  // Networks this crypto supports
  networks: INetwork[];

  // Metadata
  priority?: number; // Display order
  tags?: string[]; // ['stablecoin', 'popular', 'new']

  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const networkSchema = new Schema<INetwork>(
  {
    networkId: { type: String, required: true },
    name: { type: String, required: true },
    code: { type: String, required: true },
    depositEnabled: { type: Boolean, default: true },
    withdrawalEnabled: { type: Boolean, default: true },
    minDepositAmount: { type: Number, default: 0 },
    maxDepositAmount: { type: Number, default: 0 },
    minWithdrawalAmount: { type: Number, default: 0 },
    maxWithdrawalAmount: { type: Number, default: 0 },
    networkFee: { type: Number, default: 0 },
    confirmationsRequired: { type: Number, default: 6 },
    addressPattern: String,
    explorerUrl: String,
    platformDepositAddress: String,
  },
  { _id: false }
);

const cryptoSchema = new Schema<ICrypto>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: "Provider",
      index: true,
    },
    assetId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true },
    code: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    symbol: {
      type: String,
      required: true,
      uppercase: true,
    },
    icon: String,
    description: String,
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
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    networks: [networkSchema],
    priority: { type: Number, default: 0 },
    tags: [String],
    deletedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
cryptoSchema.index({ code: 1, isActive: 1 });
cryptoSchema.index({ purchaseActivated: 1, isActive: 1 });
cryptoSchema.index({ saleActivated: 1, isActive: 1 });

export const Crypto = mongoose.model<ICrypto>("Crypto", cryptoSchema);
