import mongoose, { Schema, Document } from "mongoose";

export interface ISystemBankAccount extends Document {
  accountName: string;
  accountNumber: string;
  bankName: string;
  bankCode: string;
  status: "active" | "inactive";
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SystemBankAccountSchema = new Schema<ISystemBankAccount>(
  {
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    bankName: { type: String, required: true },
    bankCode: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    isDefault: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Ensure only one default account
SystemBankAccountSchema.pre("save", async function (next) {
  if (this.isDefault) {
    await mongoose
      .model("SystemBankAccount")
      .updateMany({ _id: { $ne: this._id } }, { $set: { isDefault: false } });
  }
  next();
});

export const SystemBankAccount = mongoose.model<ISystemBankAccount>(
  "SystemBankAccount",
  SystemBankAccountSchema
);
