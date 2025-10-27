import mongoose, { Schema, Document } from 'mongoose';

export interface IReloadlyCategory extends Document {
  categoryId: number;
  name: string;
  icon?: string;
  saleTerm?: string;
  purchaseTerm?: string;
  saleActivated: boolean;
  purchaseActivated: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

const ReloadlyCategorySchema = new Schema<IReloadlyCategory>(
  {
    categoryId: { type: Number, required: true, unique: true },
    name: { type: String, required: true },
    icon: { type: String },
    saleTerm: { type: String },
    purchaseTerm: { type: String },
    saleActivated: { type: Boolean, default: false },
    purchaseActivated: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const ReloadlyCategory = mongoose.model<IReloadlyCategory>('ReloadlyCategory', ReloadlyCategorySchema);
