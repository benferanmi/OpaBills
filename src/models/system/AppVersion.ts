import mongoose, { Schema, Document } from 'mongoose';

export interface IAppVersion extends Document {
  buildNumber: number;
  version: string;
  storeLink?: string;
  isRequired: boolean;
  platform: 'Android' | 'iOS';
  createdAt: Date;
  updatedAt: Date;
}

const appVersionSchema = new Schema<IAppVersion>(
  {
    buildNumber: {
      type: Number,
      required: true,
    },
    version: {
      type: String,
      required: true,
    },
    storeLink: String,
    isRequired: {
      type: Boolean,
      default: false,
      index: true,
    },
    platform: {
      type: String,
      enum: ['Android', 'iOS'],
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index on buildNumber and platform
appVersionSchema.index({ buildNumber: 1, platform: 1 }, { unique: true });

export const AppVersion = mongoose.model<IAppVersion>('AppVersion', appVersionSchema);
