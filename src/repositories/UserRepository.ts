import { BaseRepository } from "./BaseRepository";
import { User, IUser } from "@/models/core/User";

export class UserRepository extends BaseRepository<IUser> {
  constructor() {
    super(User);
  }

  async findByEmail(email: string): Promise<IUser | null> {
    if (!email) return null;
    return this.model.findOne({ email: email.toLowerCase() }).exec();
  }

  async findByUsername(username: string): Promise<IUser | null> {
    return this.model.findOne({ username }).exec();
  }

  async findByRefCode(refCode: string): Promise<IUser | null> {
    return this.model.findOne({ refCode }).exec();
  }

  async updatePassword(
    userId: string | any,
    hashedPassword: string
  ): Promise<IUser | null> {
    // Handle both userId and email
    const filter = userId.includes("@")
      ? { email: userId.toLowerCase() }
      : { _id: userId };
    return this.model
      .findOneAndUpdate(filter, { password: hashedPassword }, { new: true })
      .exec();
  }

  async updateStatus(
    userId: string,
    status: "active" | "inactive" | "suspended"
  ): Promise<IUser | null> {
    return this.model
      .findByIdAndUpdate(userId, { status }, { new: true })
      .exec();
  }

  async verifyEmail(userId: string): Promise<IUser | null> {
    return this.model
      .findByIdAndUpdate(userId, { emailVerifiedAt: new Date() }, { new: true })
      .exec();
  }

  async verifyPhone(
    userId: string,
    phone?: number,
    phoneCode?: string
  ): Promise<IUser | null> {
    return this.model
      .findByIdAndUpdate(
        userId,
        { phoneVerifiedAt: new Date(), phone, phoneCode },
        { new: true }
      )
      .exec();
  }

  async findMany(filter: any, skip: number = 0, limit: number = 10) {
    return this.model.find(filter).skip(skip).limit(limit).exec();
  }
}
