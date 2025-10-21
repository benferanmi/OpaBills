import mongoose, { Schema, Document } from 'mongoose';

export interface ICountry extends Document {
  name: string;
  code?: string;
  iso2: string;
  iso3: string;
  phoneCode: string;
  region?: string;
  emoji?: string;
  emojiCode?: string;
  capital?: string;
  currency?: string;
  currencyName?: string;
  currencySymbol?: string;
  longitude?: string;
  latitude?: string;
  flagUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CountrySchema = new Schema<ICountry>(
  {
    name: { type: String, required: true },
    code: { type: String },
    iso2: { type: String, required: true, unique: true },
    iso3: { type: String, required: true, unique: true },
    phoneCode: { type: String, required: true },
    region: { type: String },
    emoji: { type: String },
    emojiCode: { type: String },
    capital: { type: String },
    currency: { type: String },
    currencyName: { type: String },
    currencySymbol: { type: String },
    longitude: { type: String },
    latitude: { type: String },
    flagUrl: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
CountrySchema.index({ name: 1 });
CountrySchema.index({ phoneCode: 1 });

export const Country = mongoose.model<ICountry>('Country', CountrySchema);
