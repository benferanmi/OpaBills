import { BankAccountRepository } from "@/repositories/BankAccountRepository";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { FlutterwaveService } from "./FlutterwaveService";
import { Types } from "mongoose";

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
  private flutterwaveService: FlutterwaveService;
  constructor() {
    this.bankAccountRepository = new BankAccountRepository();
    this.flutterwaveService = new FlutterwaveService();
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

    // Validating account details
    const result = await this.flutterwaveService.verifyBankAccount(
      data.accountNumber,
      data.bankCode
    );

    if (!result) {
      throw new AppError(
        "Invalid account details",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    if (result.account_name !== data.accountName) {
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
    return accounts;
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
    // TODO: use multiple provider

    const result = await this.flutterwaveService.verifyBankAccount(
      accountNumber,
      bankCode
    );

    console.log(result, "verify");
    return {
      accountNumber: result.account_number,
      accountName: result.account_name,
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
