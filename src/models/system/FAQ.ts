import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFAQ extends Document {
  faqCategoryId: Types.ObjectId;
  question: string;
  status: "active" | "inactive";
  slug: string;
  answer: string;
  createdAt: Date;
  updatedAt: Date;
}

const faqSchema = new Schema<IFAQ>(
  {
    faqCategoryId: {
      type: Schema.Types.ObjectId,
      ref: 'FaqCategory',
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
    },
    answer: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export const FAQ = mongoose.model<IFAQ>('FAQ', faqSchema);
