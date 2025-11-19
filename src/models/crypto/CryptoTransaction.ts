import mongoose, { Schema, Document, Types } from "mongoose";

export interface ICryptoTransaction extends Document {
  cryptoId: Types.ObjectId;
  userId: Types.ObjectId;

  // Transaction identifiers
  transactionId?: string; // External provider transaction ID
  reference: string; // Your internal unique reference

  // Trade details
  tradeType: "buy" | "sell";

  // Network information (snapshot from crypto.networks at time of transaction)
  network: {
    networkId: string;
    code: string;
    name: string;
    contractAddress?: string;
    confirmationsRequired: number;
    explorerUrl?: string;
  };

  walletAddress: string; // For BUY: user's wallet | For SELL: platform's wallet

  // Amounts and rates
  cryptoAmount: number; // Amount of crypto (e.g., 100 USDT)
  fiatAmount: number; // Fiat equivalent (e.g., ₦150,000)
  exchangeRate: number; // Rate at time of transaction
  serviceFee: number; // Platform fee in fiat
  networkFee?: number; // Blockchain fee (if applicable)
  totalAmount: number; // For BUY: total debit | For SELL: total payout

  // Status tracking
  status:
    | "pending"
    | "processing"
    | "approved"
    | "success"
    | "failed"
    | "declined"
    | "refunded";

  // Blockchain details
  txHash?: string; // Blockchain transaction hash
  confirmations?: number; // Current number of confirmations
  blockNumber?: number; // Block number where tx was included

  // For SELL transactions - Bank details
  bankId?: Types.ObjectId;
  bankCode?: string;
  accountName?: string;
  accountNumber?: string;

  // Proof of payment (for SELL - user uploads)
  proof?: string; // URL to uploaded screenshot/document

  // Admin review (for manual processing)
  reviewedBy?: Types.ObjectId; // Admin user ID
  reviewedAt?: Date;
  reviewNote?: string; // Admin's notes
  reviewRate?: number; // Adjusted rate if needed
  reviewAmount?: number; // Adjusted amount if needed
  reviewProof?: string; // Admin's proof of payout

  // Additional data
  comment?: string; // User's comment
  meta?: Record<string, any>; // Flexible field for extra data

  // Processing tracking
  processedAt?: Date; // When crypto was sent/received
  completedAt?: Date; // When entire flow completed

  // Error handling
  errorMessage?: string;
  retryCount?: number;

  createdAt: Date;
  updatedAt: Date;
}

const cryptoTransactionSchema = new Schema<ICryptoTransaction>(
  {
    cryptoId: {
      type: Schema.Types.ObjectId,
      ref: "Crypto",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    transactionId: String,
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    tradeType: {
      type: String,
      enum: ["buy", "sell"],
      required: true,
      index: true,
    },
    network: {
      type: {
        networkId: { type: String, required: true },
        code: { type: String, required: true },
        name: { type: String, required: true },
        contractAddress: String,
        confirmationsRequired: Number,
        explorerUrl: String,
      },
      required: true,
    },
    walletAddress: {
      type: String,
      required: true,
      trim: true,
    },
    cryptoAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    fiatAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    exchangeRate: {
      type: Number,
      required: true,
      min: 0,
    },
    serviceFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    networkFee: {
      type: Number,
      min: 0,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "approved",
        "success",
        "failed",
        "declined",
        "refunded",
      ],
      default: "pending",
      required: true,
      index: true,
    },
    txHash: {
      type: String,
      trim: true,
      index: true,
      sparse: true, // Allows multiple null values
    },
    confirmations: {
      type: Number,
      min: 0,
    },
    blockNumber: Number,
    bankId: { type: Types.ObjectId, ref: "Bank" },
    bankCode: String,
    accountName: String,
    accountNumber: String,
    proof: String,
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewedAt: Date,
    reviewNote: String,
    reviewRate: Number,
    reviewAmount: Number,
    reviewProof: String,
    comment: String,
    meta: Schema.Types.Mixed,
    processedAt: Date,
    completedAt: Date,
    errorMessage: String,
    retryCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for common queries
cryptoTransactionSchema.index({ userId: 1, createdAt: -1 });
cryptoTransactionSchema.index({ status: 1, createdAt: -1 });
cryptoTransactionSchema.index({ tradeType: 1, status: 1 });
cryptoTransactionSchema.index({ cryptoId: 1, createdAt: -1 });

export const CryptoTransaction = mongoose.model<ICryptoTransaction>(
  "CryptoTransaction",
  cryptoTransactionSchema
);
