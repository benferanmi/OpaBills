import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IState extends Document {
  countryId: Types.ObjectId;
  name: string;
  code?: string;
  longitude?: string;
  latitude?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StateSchema = new Schema<IState>(
  {
    countryId: { type: Schema.Types.ObjectId, ref: 'Country', required: true },
    name: { type: String, required: true },
    code: { type: String },
    longitude: { type: String },
    latitude: { type: String },
  },
  {
    timestamps: true,
  }
);

// Indexes
StateSchema.index({ countryId: 1 });
StateSchema.index({ name: 1 });

export const State = mongoose.model<IState>('State', StateSchema);
