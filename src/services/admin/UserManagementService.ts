import { UserRepository } from "@/repositories/UserRepository";
import { WalletRepository } from "@/repositories/WalletRepository";
import { LedgerRepository } from "@/repositories/LedgerRepository";
import { generateReference } from "@/utils/helpers";

export class UserManagementService {
  private userRepository: UserRepository;
  private walletRepository: WalletRepository;
  private ledgerRepository: LedgerRepository;

  constructor() {
    this.userRepository = new UserRepository();
    this.walletRepository = new WalletRepository();
    this.ledgerRepository = new LedgerRepository();
  }

  async listUsers(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = { deletedAt: null };

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.emailVerified === "true") {
      query.emailVerifiedAt = { $ne: null };
    } else if (filters.emailVerified === "false") {
      query.emailVerifiedAt = null;
    }

    if (filters.phoneVerified === "true") {
      query.phoneVerifiedAt = { $ne: null };
    } else if (filters.phoneVerified === "false") {
      query.phoneVerifiedAt = null;
    }

    if (filters.search) {
      query.$or = [
        { firstname: { $regex: filters.search, $options: "i" } },
        { lastname: { $regex: filters.search, $options: "i" } },
        { email: { $regex: filters.search, $options: "i" } },
        { phone: { $regex: filters.search, $options: "i" } },
      ];
    }

    const result = await this.userRepository.findWithPagination(
      query,
      page,
      limit
    );

    return {
      users: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async getUserDetails(userId: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const wallet = await this.walletRepository.findByUserId(userId);

    return {
      user: {
        id: user._id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        phone: user.phone,
        phoneCode: user.phoneCode,
        username: user.username,
        gender: user.gender,
        refCode: user.refCode,
        avatar: user.avatar,
        country: user.country,
        state: user.state,
        status: user.status,
        emailVerifiedAt: user.emailVerifiedAt,
        phoneVerifiedAt: user.phoneVerifiedAt,
        pinActivatedAt: user.pinActivatedAt,
        twoFactorEnabledAt: user.twoFactorEnabledAt,
        createdAt: user.createdAt,
      },
      wallet: wallet
        ? {
            mainBalance: wallet.balance, // balance field is the main balance
            bonusBalance: wallet.bonusBalance,
            commissionBalance: wallet.commissionBalance,
            lockedAt: wallet.lockedAt,
          }
        : null,
    };
  }

  async updateUserStatus(userId: string, status: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    user.status = status as any;
    await user.save();

    return { message: "User status updated successfully", status: user.status };
  }

  async markUserAsFraudulent(userId: string, reason: string) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    user.status = "suspended";
    await user.save();

    // Lock wallet
    const wallet = await this.walletRepository.findByUserId(userId);
    if (wallet) {
      wallet.lockedAt = new Date();
      await wallet.save();
    }

    return {
      message: "User marked as fraudulent and account suspended",
      reason,
    };
  }

  async creditUserWallet(
    userId: string,
    amount: number,
    type: "main" | "bonus" | "commission",
    remark: string
  ) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.lockedAt) {
      throw new Error("Wallet is locked");
    }

    const reference = generateReference("ADM");

    // Get balance before update
    const balanceBefore =
      type === "main"
        ? wallet.balance
        : type === "bonus"
        ? wallet.bonusBalance
        : wallet.commissionBalance;

    // Update wallet balance based on type
    if (type === "main") {
      wallet.balance += amount;
    } else if (type === "bonus") {
      wallet.bonusBalance += amount;
    } else if (type === "commission") {
      wallet.commissionBalance += amount;
    }

    await wallet.save();

    const balanceAfter =
      type === "main"
        ? wallet.balance
        : type === "bonus"
        ? wallet.bonusBalance
        : wallet.commissionBalance;

    // Create ledger entry
    await this.ledgerRepository.createLedgerEntry({
      userId: wallet.userId,
      walletId: wallet.id,
      type: "credit",
      amount,
      balanceBefore,
      balanceAfter,
      reference,
      description: remark || "Admin credit",
      meta: { walletType: type },
    });

    return {
      message: "Wallet credited successfully",
      amount,
      newBalance: balanceAfter,
    };
  }

  async debitUserWallet(
    userId: string,
    amount: number,
    type: "main" | "bonus" | "commission",
    remark: string
  ) {
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new Error("User not found");
    }

    const wallet = await this.walletRepository.findByUserId(userId);

    if (!wallet) {
      throw new Error("Wallet not found");
    }

    if (wallet.lockedAt) {
      throw new Error("Wallet is locked");
    }

    const currentBalance =
      type === "main"
        ? wallet.balance
        : type === "bonus"
        ? wallet.bonusBalance
        : wallet.commissionBalance;

    if (currentBalance < amount) {
      throw new Error("Insufficient balance");
    }

    const reference = generateReference("ADM");

    // Update wallet balance based on type
    if (type === "main") {
      wallet.balance -= amount;
    } else if (type === "bonus") {
      wallet.bonusBalance -= amount;
    } else if (type === "commission") {
      wallet.commissionBalance -= amount;
    }

    await wallet.save();

    const balanceAfter =
      type === "main"
        ? wallet.balance
        : type === "bonus"
        ? wallet.bonusBalance
        : wallet.commissionBalance;

    // Create ledger entry
    await this.ledgerRepository.createLedgerEntry({
      userId: wallet.userId,
      walletId: wallet.id,
      type: "debit",
      amount,
      balanceBefore: currentBalance,
      balanceAfter,
      reference,
      description: remark || "Admin debit",
      meta: { walletType: type },
    });

    return {
      message: "Wallet debited successfully",
      amount,
      newBalance: balanceAfter,
    };
  }
}
