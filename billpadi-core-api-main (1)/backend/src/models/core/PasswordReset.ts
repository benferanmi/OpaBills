import mongoose, { Schema, Document } from 'mongoose';

export interface IPasswordReset extends Document {
  email: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
}

const PasswordResetSchema = new Schema<IPasswordReset>({
  email: { type: String, required: true },
  token: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});

// TTL index - auto-delete after expiry
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PasswordResetSchema.index({ email: 1 });
PasswordResetSchema.index({ token: 1 });

export const PasswordReset = mongoose.model<IPasswordReset>('PasswordReset', PasswordResetSchema);
