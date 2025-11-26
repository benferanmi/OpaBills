import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { SaveHavenService } from "./SaveHavenService";
import { MonnifyService } from "./MonnifyService";
import { BankRepository } from "@/repositories/BankRepository";
export interface CreateBankAccountDTO {
  userId: Types.ObjectId;
  bankId?: Types.ObjectId;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  recipientCode?: string;
}

export class BankAccountService {
  private bankAccountRepository: BankAccountRepository;
  private saveHavenService: SaveHavenService;
  private monnifyService: MonnifyService;
  private bankRepository: BankRepository;
  constructor() {
    this.bankAccountRepository = new BankAccountRepository();
    this.saveHavenService = new SaveHavenService();
    this.monnifyService = new MonnifyService();
    this.bankRepository = new BankRepository();
  }

  async createBankAccount(data: CreateBankAccountDTO): Promise<any> {
    // Check if account already exists
    const existing = await this.bankAccountRepository.findByAccountNumber(
      data.userId,
      data.accountNumber
    );
    if (existing) {
      throw new AppError(
        "Bank account already exists",
        HTTP_STATUS.CONFLICT,
        ERROR_CODES.DUPLICATE_ENTRY
      );
    }

    // Validating account details with msavehaven
    // const result = await this.saveHavenService.nameEnquiry(
    //   data.accountNumber,
    //   data.bankCode
    // );

    // Validating account details with monnify
    // const result = await this.monnifyService.verifyBankAccount(
    //   data.accountNumber,
    //   data.bankCode
    // );

    const result = await this.saveHavenService.nameEnquiry(
      data.accountNumber,
      data.bankCode
    );

    // console.log(result, "monnify result");
    console.log(result, "savehaven result");

    if (!result) {
      throw new AppError(
        "Invalid account details",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (result.accountName !== data.accountName) {
      throw new AppError(
        "Account name does not match",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const bankAccount = await this.bankAccountRepository.create(data);
    return bankAccount;
  }

  async getUserBankAccounts(userId: string): Promise<any> {
    const accounts = await this.bankAccountRepository.findByUserId(userId);

    if (!accounts || accounts.length === 0) {
      return accounts;
    }

    // Fetch bank details for all accounts in parallel
    const accountsWithBankNames = await Promise.all(
      accounts.map(async (account) => {
        const bank = await this.bankRepository.findBySavehavenCode(
          account.bankCode
        );

        const plainAccount = account.toObject ? account.toObject() : account;
        return {
          ...plainAccount,
          bankName: bank?.name || "Unknown Bank",
        };
      })
    );

    return accountsWithBankNames;
  }

  async getBankAccount(accountId: string): Promise<any> {
    const account = await this.bankAccountRepository.findById(accountId);
    if (!account) {
      throw new AppError(
        "Bank account not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    return account;
  }

  async deleteBankAccount(accountId: string): Promise<void> {
    await this.bankAccountRepository.softDelete(accountId);
  }

  async verifyBankAccount(
    bankCode: string,
    accountNumber: string
  ): Promise<any> {
    const result = await this.saveHavenService.nameEnquiry(
      accountNumber,
      bankCode
    );

    console.log(result, "verify");
    return {
      accountNumber: result.accountNumber,
      accountName: result.accountName,
      bankCode,
    };
  }

  async setDefaultBankAccount(userId: string, accountId: string): Promise<any> {
    const account = await this.bankAccountRepository.findById(accountId);
    if (!account) {
      throw new AppError(
        "Bank account not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (account.userId.toString() !== userId) {
      throw new AppError(
        "Unauthorized",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.AUTHORIZATION_ERROR
      );
    }

    // TODO: Add isDefault field to schema and update all user accounts
    return account;
  }
}
