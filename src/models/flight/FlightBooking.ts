import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IFlightBooking extends Document {
  _id: string; // UUID
  userId: Types.ObjectId;
  bookingId?: string;
  reference: string;
  amount: number;
  passengers?: any[];
  ticketingAgreement?: any;
  offer?: any;
  meta?: any;
  status: 'pending' | 'confirmed' | 'cancelled' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

const flightBookingSchema = new Schema<IFlightBooking>(
  {
    _id: {
      type: String,
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bookingId: {
      type: String,
      index: true,
    },
    reference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    passengers: [Schema.Types.Mixed],
    ticketingAgreement: Schema.Types.Mixed,
    offer: Schema.Types.Mixed,
    meta: Schema.Types.Mixed,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'failed'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

export const FlightBooking = mongoose.model<IFlightBooking>('FlightBooking', flightBookingSchema);
