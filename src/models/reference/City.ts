import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICity extends Document {
  stateId: Types.ObjectId;
  name: string;
  longitude?: string;
  latitude?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CitySchema = new Schema<ICity>(
  {
    stateId: { type: Schema.Types.ObjectId, ref: 'State', required: true },
    name: { type: String, required: true },
    longitude: { type: String },
    latitude: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
CitySchema.index({ stateId: 1 });
CitySchema.index({ name: 1 });

export const City = mongoose.model<ICity>('City', CitySchema);
