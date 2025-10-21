import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IReferral extends Document {
  refereeId: Types.ObjectId;
  referredId: Types.ObjectId;
  amount: number;
  cumulativeAmount: number;
  paid: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ReferralSchema = new Schema<IReferral>(
  {
    refereeId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    referredId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, default: 0 },
    cumulativeAmount: { type: Number, default: 0 },
    paid: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Indexes
ReferralSchema.index({ refereeId: 1 });
ReferralSchema.index({ referredId: 1 });
ReferralSchema.index({ paid: 1 });

export const Referral = mongoose.model<IReferral>('Referral', ReferralSchema);
