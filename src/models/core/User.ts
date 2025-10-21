import mongoose, { Schema, Document, Types } from "mongoose";

export interface IUser extends Document {
  firstname: string;
  lastname: string;
  email: string;
  phoneCode?: string;
  phone?: string;
  username?: string;
  gender?: "male" | "female" | "other";
  refCode?: string;
  referredBy?: Types.ObjectId | undefined;
  avatar?: string;
  country?: string;
  state?: string;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  pinActivatedAt?: Date;
  twoFactorEnabledAt?: Date;
  twofactorEnabled?: boolean;
  loginBiometricEnabled?: boolean;
  transactionBiometricEnabled?: boolean;
  password: string;
  status: "active" | "inactive" | "suspended";
  fcmToken?: string;
  authType: "password" | "biometric" | "social";
  pin?: string;
  otp?: string;
  otpExpiry?: Date;
  virtualAccount?: any;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface IUserResponse {
  id: string;
  firstname: string;
  lastname: string;
  email: string;

  phoneCode?: string;
  phone?: string;
  username?: string;
  gender?: "male" | "female" | "other";
  refCode?: string;
  referredBy?: string | Types.ObjectId;
  avatar?: string;
  country?: string;
  state?: string;

  status?: "active" | "inactive" | "suspended";
  authType?: "password" | "biometric" | "social";
  twofactorEnabled?: boolean;

  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  pinActivatedAt?: Date;
  twoFactorEnabledAt?: Date;
  loginBiometricEnabled?: boolean;
  transactionBiometricEnabled?: boolean;

  fcmToken?: string;
  virtualAccount?: any;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date;
}

const UserSchema = new Schema<IUser>(
  {
    firstname: { type: String, required: true },
    lastname: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phoneCode: { type: String },
    phone: { type: String },
    username: { type: String, unique: true, sparse: true },
    gender: { type: String, enum: ["male", "female", "other"] },
    refCode: { type: String, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    avatar: { type: String },
    country: { type: String },
    state: { type: String },
    emailVerifiedAt: { type: Date },
    phoneVerifiedAt: { type: Date },
    pinActivatedAt: { type: Date },
    twoFactorEnabledAt: { type: Date },
    twofactorEnabled: { type: Boolean, default: false },
    loginBiometricEnabled: { type: Boolean, default: false },
    transactionBiometricEnabled: { type: Boolean, default: false },
    password: { type: String, required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    fcmToken: { type: String },
    authType: {
      type: String,
      enum: ["password", "biometric", "social"],
      default: "password",
    },
    pin: { type: String },
    otp: { type: String },
    otpExpiry: { type: Date },
    virtualAccount: { type: Schema.Types.Mixed },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

// Indexes
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>("User", UserSchema);
