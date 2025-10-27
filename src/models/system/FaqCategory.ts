import mongoose, { Schema, Document } from 'mongoose';

export interface IFaqCategory extends Document {
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const faqCategorySchema = new Schema<IFaqCategory>(
  {
    name: {
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
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const FaqCategory = mongoose.model<IFaqCategory>('FaqCategory', faqCategorySchema);
