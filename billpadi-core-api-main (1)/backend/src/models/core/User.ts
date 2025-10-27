import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IUser extends Document {
  firstname: string;
  lastname: string;
  email: string;
  phoneCode?: string;
  phone?: string;
  username?: string;
  gender?: 'male' | 'female' | 'other';
  refCode?: string;
  avatar?: string;
  country?: string;
  state?: string;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  pinActivatedAt?: Date;
  twoFactorEnabledAt?: Date;
  loginBiometricActivatedAt?: Date;
  transactionBiometricActivatedAt?: Date;
  password: string;
  status: 'active' | 'inactive' | 'suspended';
  fcmToken?: string;
  authType: 'password' | 'biometric' | 'social';
  pin?: string;
  otp?: string;
  otpExpiry?: Date;
  virtualAccount?: any;
  createdAt: Date;
  updatedAt: Date;
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
    gender: { type: String, enum: ['male', 'female', 'other'] },
    refCode: { type: String, unique: true, sparse: true },
    avatar: { type: String },
    country: { type: String },
    state: { type: String },
    emailVerifiedAt: { type: Date },
    phoneVerifiedAt: { type: Date },
    pinActivatedAt: { type: Date },
    twoFactorEnabledAt: { type: Date },
    loginBiometricActivatedAt: { type: Date },
    transactionBiometricActivatedAt: { type: Date },
    password: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active',
    },
    fcmToken: { type: String },
    authType: {
      type: String,
      enum: ['password', 'biometric', 'social'],
      default: 'password',
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
UserSchema.index({ email: 1 });
UserSchema.index({ username: 1 });
UserSchema.index({ refCode: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ createdAt: -1 });

export const User = mongoose.model<IUser>('User', UserSchema);
