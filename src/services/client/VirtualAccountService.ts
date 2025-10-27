import { VirtualAccountRepository } from "@/repositories/VirtualAccountRepository";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { v4 as uuidv4 } from "uuid";
import { Types } from "mongoose";
import { FlutterwaveService } from "./FlutterwaveService";
import { generateReference } from "@/utils/helpers";
import { UserRepository } from "@/repositories/UserRepository";

export type PROVIDER_ENUMS =
  | "flutterwave"
  | "paystack"
  | "monnify"
  | "savehaven";

export interface CreateVirtualAccountDTO {
  userId: string;
  type: "permanent" | "temporary";
  provider: PROVIDER_ENUMS;
  identificationData: {
    bvn?: string;
    nin?: string;
  };
  identificationType: "bvn" | "nin";
  firstname: string;
  lastname: string;
}

export class VirtualAccountService {
  private virtualAccountRepository: VirtualAccountRepository;
  private flutterwaveService = new FlutterwaveService();
  private userRepository = new UserRepository();

  constructor() {
    this.virtualAccountRepository = new VirtualAccountRepository();
  }

  async createVirtualAccount(data: CreateVirtualAccountDTO) {
    const user = await this.userRepository.findById(data.userId);
    if (!user) {
      throw new AppError(
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    // Check if user already has an account of this type
    const existing = await this.virtualAccountRepository.findByUserAndType(
      data.userId,
      data.type
    );
    if (existing) {
      return existing;
    }

    const payload: any = {
      email: user.email,
      is_permanent: true,
      tx_ref: generateReference("VAX"),
      firstname: user.firstname,
      lastname: user.lastname,
      narration: "Virtual Account for " + user.firstname,
    };

    if (data.identificationType === "bvn") {
      payload.bvn = data.identificationData.bvn;
      user.bvn = data.identificationData.bvn!;
      await user.save();
    } else if (data.identificationType === "nin") {
      payload.nin = data.identificationData.nin;
      user.nin = data.identificationData.nin!;
      await user.save();
    }

    const result = await this.flutterwaveService.createVirtualAccount(payload);

    const virtualAccount = await this.virtualAccountRepository.createAccount({
      userId: new Types.ObjectId(data.userId),
      provider: data.provider,
      type: data.type,
      accountNumber: result.account_number,
      accountName: `${user.firstname} ${user.lastname}`,
      bankName: result.bank_name,
      bankCode: undefined,
      orderReference: result.order_ref,
      flwRef: result.flw_ref,
    });

    return virtualAccount;
  }

  async getVirtualAccounts(userId: string, filters: any = {}) {
    if (filters.type) {
      const account = await this.virtualAccountRepository.findByUserAndType(
        userId,
        filters.type
      );
      return account ? [account] : [];
    }

    return this.virtualAccountRepository.findActiveAccounts(userId);
  }

  async getVirtualAccountById(accountId: string) {
    const account = await this.virtualAccountRepository.findById(accountId);
    if (!account || account.deletedAt) {
      throw new AppError(
        "Virtual account not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return account;
  }
}
