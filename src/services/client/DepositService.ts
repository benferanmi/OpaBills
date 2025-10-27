import {
  DepositRepository,
  DepositRequestRepository,
} from "@/repositories/DepositRepository";
import { VirtualAccountRepository } from "@/repositories/VirtualAccountRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { generateReference } from "@/utils/helpers";

export class DepositService {
  private depositRepository: DepositRepository;
  private depositRequestRepository: DepositRequestRepository;
  private virtualAccountRepository: VirtualAccountRepository;
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  constructor() {
    this.depositRepository = new DepositRepository();
    this.depositRequestRepository = new DepositRequestRepository();
    this.virtualAccountRepository = new VirtualAccountRepository();
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
  }

  async createDepositRequest(data: {
    userId: string;
    amount: number;
    proof: string;
    provider?: string;
  }) {
    const reference = generateReference();

    const depositRequest = await this.depositRequestRepository.create({
      _id: uuidv4(),
      userId: new Types.ObjectId(data.userId),
      reference,
      provider: data.provider || "manual",
      amount: data.amount,
      proof: data.proof,
      status: "pending",
    });

    return depositRequest;
  }

  async handleDepositWebhook(data: {
    reference: string;
    amount: number;
    accountNumber: string;
    meta?: any;
  }) {
    // Find virtual account
    const virtualAccount =
      await this.virtualAccountRepository.findByAccountNumber(
        data.accountNumber
      );
    if (!virtualAccount) {
      throw new AppError(
        "Virtual account not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Check if deposit already exists
    const existing = await this.depositRepository.findByReference(
      data.reference
    );
    if (existing) {
      return existing;
    }

    // Create deposit record
    const deposit = await this.depositRepository.create({
      _id: uuidv4(),
      userId: virtualAccount.userId,
      reference: data.reference,
      provider: virtualAccount.provider,
      amount: data.amount,
      status: "success",
      meta: data.meta,
    });

    // Credit wallet
    const wallet = await this.walletService.creditWallet(
      virtualAccount.userId.toString(),
      data.amount,
      `Wallet funding via ${data.reference}`,
      "main"
    );

    // Create transaction record
    await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: virtualAccount.userId,
      transactableType: "Deposit",
      transactableId: new Types.ObjectId(deposit._id),
      reference: data.reference,
      amount: data.amount,
      type: "deposit",
      provider: virtualAccount.provider,
      remark: `Deposit via virtual account`,
      purpose: "wallet_funding",
      status: "success",
      meta: data.meta,
    });

    // Send notification
    await this.notificationRepository.create({
      type: "wallet_credit",
      notifiableType: "User",
      notifiableId: virtualAccount.userId,
      data: {
        amount: data.amount,
        balance: wallet.balance,
        reference: data.reference,
      },
    });

    return deposit;
  }

  async getDeposits(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.provider) {
      query.provider = filters.provider;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    return this.depositRepository.findByUserId(userId, query, page, limit);
  }

  async getDepositRequests(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    return this.depositRequestRepository.findByUserId(
      userId,
      query,
      page,
      limit
    );
  }

  async getDepositById(depositId: string) {
    const deposit = await this.depositRepository.findById(depositId);
    if (!deposit) {
      throw new AppError(
        "Deposit not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return deposit;
  }
}
