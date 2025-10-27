import mongoose, { Schema, Document } from 'mongoose';

export interface IRouteAction extends Document {
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const routeActionSchema = new Schema<IRouteAction>(
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

export const RouteAction = mongoose.model<IRouteAction>('RouteAction', routeActionSchema);
