import mongoose, { Schema, Document } from 'mongoose';

export interface IBanner extends Document {
  previewImageUrl: string;
  featuredImageUrl: string;
  activatedAt?: Date;
  target?: string;
  createdAt: Date;
  updatedAt: Date;
}

const bannerSchema = new Schema<IBanner>(
  {
    previewImageUrl: {
      type: String,
      required: true,
    },
    featuredImageUrl: {
      type: String,
      required: true,
    },
    activatedAt: {
      type: Date,
      index: true,
    },
    target: String,
  },
  {
    timestamps: true,
  }
);

export const Banner = mongoose.model<IBanner>('Banner', bannerSchema);
