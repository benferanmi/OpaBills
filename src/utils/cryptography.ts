import bcrypt from "bcrypt";
import crypto from "crypto";

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

export const comparePassword = async (
  password: string,
  hashedPassword: string
): Promise<boolean> => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateOTP = (length: number = 6): string => {
  const digits = "0123456789";
  let otp = "";
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  return otp;
};

export const isPasswordInHistory = async (
  newPassword: string,
  passwordHistory: string[]
): Promise<boolean> => {
  for (const hashedPassword of passwordHistory) {
    if (await comparePassword(newPassword, hashedPassword)) {
      return true;
    }
  }
  return false;
};

export function updatePasswordHistory(
  passwordHistory: string[],
  newPasswordHash: string,
  maxHistory: number = 5
): string[] {
  const updatedHistory = [newPasswordHash, ...passwordHistory];
  return updatedHistory.slice(0, maxHistory);
}
