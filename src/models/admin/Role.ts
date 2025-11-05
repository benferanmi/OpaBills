import mongoose, { Schema, Document } from "mongoose";

export interface IRole extends Document {
  name: string;
  slug: string;
  description?: string;
  permissions: string[];
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    permissions: [{ type: String }],
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Role = mongoose.model<IRole>("Role", RoleSchema);
