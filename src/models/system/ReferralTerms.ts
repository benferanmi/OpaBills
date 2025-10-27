import mongoose, { Schema, Document } from 'mongoose';

export interface IReferralTerms extends Document {
  title: string;
  slug: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

const referralTermsSchema = new Schema<IReferralTerms>(
  {
    title: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const ReferralTerms = mongoose.model<IReferralTerms>('ReferralTerms', referralTermsSchema);
