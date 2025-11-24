import mongoose, { Schema, Document, Types } from "mongoose";

export interface IGiftCardTransaction extends Document {
  giftCardType?: string;
  giftCardId?: Types.ObjectId;
  userId: Types.ObjectId;
  parentId?: Types.ObjectId; // Changed to ObjectId for referencing parent transaction
  transactionId?: Types.ObjectId;
  reference: string;
  tradeType: "buy" | "sell";

  // Sell-specific fields
  cardType?: "physical" | "ecode";
  cards?: string[]; 
  comment?: string;
  bankAccountId?: Types.ObjectId;

  // Transaction amounts
  amount: number;
  quantity: number;
  serviceCharge?: number;
  rate?: number;
  payableAmount?: number;

  // Grouping for multiple transactions
  groupTag?: string;

  status:
    | "pending"
    | "processing"
    | "success"
    | "failed"
    | "approved"
    | "declined"
    | "multiple"
    | "s.approved";
  preorder: boolean;

  // Bank details (copied from bankAccountId for reference)
  bankId?: Types.ObjectId;
  bankCode?: string;
  accountName?: string;
  accountNumber?: string;

  // Admin review fields
  reviewNote?: string;
  reviewRate?: number; // New rate if price changed during approval
  reviewAmount?: number; // New amount if price changed
  reviewProof?: string; // Proof document for second approval
  reviewedBy?: Types.ObjectId; // Admin who reviewed
  reviewedAt?: Date;

  // Second approval fields
  secondApprovalBy?: Types.ObjectId;
  secondApprovalAt?: Date;
  secondApprovalNote?: string;
  originalRate?: number; // Store original rate for comparison
  originalAmount?: number; // Store original amount for comparison

  // Provider reference (for buy transactions)
  providerReference?: string;

  // Metadata
  meta?: {
    recipientEmail?: string;
    recipientPhone?: string;
    cardImages?: string[]; // Store multiple card images
    ipAddress?: string;
    userAgent?: string;
    [key: string]: any;
  };

  createdAt: Date;
  updatedAt: Date;
}

const GiftCardTransactionSchema = new Schema<IGiftCardTransaction>(
  {
    giftCardType: { type: String },
    giftCardId: { type: Schema.Types.ObjectId, ref: "GiftCard" },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "GiftCardTransaction" },
    transactionId: { type: Schema.Types.ObjectId, ref: "Transaction" },
    reference: { type: String, required: true, unique: true },
    tradeType: { type: String, enum: ["buy", "sell"], required: true },

    // Sell-specific fields
    cardType: { type: String, enum: ["physical", "ecode"] },
    cards: [{ type: String }],
    comment: { type: String },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount" },

    // Transaction amounts
    amount: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
    serviceCharge: { type: Number, default: 0 },
    rate: { type: Number },
    payableAmount: { type: Number },

    // Grouping
    groupTag: { type: String },

    // Status
    status: {
      type: String,
      enum: [
        "pending",
        "processing",
        "success",
        "failed",
        "approved",
        "declined",
        "multiple",
        "s.approved",
      ],
      default: "pending",
    },
    preorder: { type: Boolean, default: false },

    // Bank details
    bankId: { type: Schema.Types.ObjectId, ref: "Bank" },
    bankCode: { type: String },
    accountName: { type: String },
    accountNumber: { type: String },

    // Admin review
    reviewNote: { type: String },
    reviewRate: { type: Number },
    reviewAmount: { type: Number },
    reviewProof: { type: String },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    reviewedAt: { type: Date },

    // Second approval
    secondApprovalBy: { type: Schema.Types.ObjectId, ref: "Admin" },
    secondApprovalAt: { type: Date },
    secondApprovalNote: { type: String },
    originalRate: { type: Number },
    originalAmount: { type: Number },

    // Provider
    providerReference: { type: String },

    // Metadata
    meta: { type: Schema.Types.Mixed },
  },
  {
    timestamps: true,
  }
);

// Indexes
GiftCardTransactionSchema.index({ userId: 1 });
GiftCardTransactionSchema.index({ giftCardId: 1 });
GiftCardTransactionSchema.index({ status: 1 });
GiftCardTransactionSchema.index({ tradeType: 1 });
GiftCardTransactionSchema.index({ groupTag: 1 });
GiftCardTransactionSchema.index({ parentId: 1 });
GiftCardTransactionSchema.index({ createdAt: -1 });

// Virtual for children transactions (when status is 'multiple')
GiftCardTransactionSchema.virtual("children", {
  ref: "GiftCardTransaction",
  localField: "_id",
  foreignField: "parentId",
});

export const GiftCardTransaction = mongoose.model<IGiftCardTransaction>(
  "GiftCardTransaction",
  GiftCardTransactionSchema
);
