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
    const reference = generateReference("DEPREQ");

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Create DepositRequest (status: pending)
    const depositRequest = await this.depositRequestRepository.create({
      _id: uuidv4(),
      userId: new Types.ObjectId(data.userId),
      reference,
      provider: data.provider || "manual",
      amount: data.amount,
      proof: data.proof,
      status: "pending", // Awaiting admin approval
    });

    // Notify user
    await this.notificationRepository.create({
      type: "deposit_request_submitted",
      notifiableType: "User",
      notifiableId: new Types.ObjectId(data.userId),
      data: {
        amount: data.amount,
        reference,
        status: "pending",
      },
    });

    // Notify admins (optional)
    // TODO: Send notification to admin

    return depositRequest;
  }

  // For automated deposits (webhook from payment provider)
  async handleDepositWebhook(data: {
    reference: string;
    amount: number;
    accountNumber: string;
    meta?: any;
  }) {
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

    // Check if already processed
    const existing = await this.depositRepository.findByReference(
      data.reference
    );
    if (existing) {
      return existing;
    }

    const wallet = await this.walletService.getWallet(
      virtualAccount.userId.toString()
    );

    // Create Deposit (status: success - already verified)
    const deposit = await this.depositRepository.create({
      _id: uuidv4(),
      userId: virtualAccount.userId,
      walletId: wallet._id,
      reference: data.reference,
      provider: virtualAccount.provider,
      amount: data.amount,
      status: "success", // Already verified by provider
      meta: data.meta,
    });

    // Credit wallet immediately
    const updatedWallet = await this.walletService.creditWallet(
      virtualAccount.userId.toString(),
      data.amount,
      `Wallet funding via ${data.reference}`,
      "main"
    );

    // Create transaction
    await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: virtualAccount.userId,
      transactableType: "Deposit",
      transactableId: deposit.id,
      reference: data.reference,
      amount: data.amount,
      direction: "CREDIT",
      type: "wallet_funding",
      provider: virtualAccount.provider,
      status: "success",
      purpose: "deposit",
      meta: data.meta,
    });

    // Notify user
    await this.notificationRepository.create({
      type: "wallet_credit",
      notifiableType: "User",
      notifiableId: virtualAccount.userId,
      data: {
        amount: data.amount,
        balance: updatedWallet.balance,
        reference: data.reference,
      },
    });

    return deposit;
  }

  // Admin approves DepositRequest -> creates Deposit
  async approveDepositRequest(requestId: string, adminId: string) {
    const request = await this.depositRequestRepository.findById(requestId);
    if (!request) {
      throw new AppError("Request not found", 404, ERROR_CODES.NOT_FOUND);
    }

    if (request.status !== "pending") {
      throw new AppError(
        "Request already processed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    const wallet = await this.walletService.getWallet(
      request.userId.toString()
    );

    // Update request status
    await this.depositRequestRepository.update(requestId, {
      status: "approved",
      approvedAt: new Date(),
      approvedBy: adminId,
    });

    // Create Deposit record
    const deposit = await this.depositRepository.create({
      userId: request.userId,
      walletId: wallet._id,
      reference: request.reference,
      provider: request.provider,
      amount: request.amount,
      status: "success",
      meta: {
        depositRequestId: requestId,
        proof: request.proof,
      },
    });

    // Credit wallet
    const updatedWallet = await this.walletService.creditWallet(
      request.userId.toString(),
      request.amount,
      `Manual deposit approved - ${request.reference}`,
      "main"
    );

    // Create transaction
    await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: request.userId,
      transactableType: "Deposit",
      transactableId: deposit.id,
      reference: request.reference,
      amount: request.amount,
      direction: "CREDIT",
      type: "manual_deposit",
      provider: request.provider,
      status: "success",
      purpose: "deposit",
      meta: {
        depositRequestId: requestId,
      },
    });

    // Notify user
    await this.notificationRepository.create({
      type: "deposit_approved",
      notifiableType: "User",
      notifiableId: request.userId,
      data: {
        amount: request.amount,
        balance: updatedWallet.balance,
        reference: request.reference,
      },
    });

    return deposit;
  }

  // Admin declines DepositRequest
  async declineDepositRequest(
    requestId: string,
    adminId: string,
    reason: string
  ) {
    const request = await this.depositRequestRepository.findById(requestId);
    if (!request) {
      throw new AppError("Request not found", 404, ERROR_CODES.NOT_FOUND);
    }

    if (request.status !== "pending") {
      throw new AppError(
        "Request already processed",
        400,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    await this.depositRequestRepository.update(requestId, {
      status: "declined",
      declinedAt: new Date(),
      declinedBy: adminId,
      declineReason: reason,
    });

    // Notify user
    await this.notificationRepository.create({
      type: "deposit_declined",
      notifiableType: "User",
      notifiableId: request.userId,
      data: {
        amount: request.amount,
        reference: request.reference,
        reason,
      },
    });

    return request;
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
