import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { ProviderService } from "./ProviderService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { generateReference } from "@/utils/helpers";
import { Types } from "mongoose";

export class InternationalService {
  constructor(
    private transactionRepository: TransactionRepository,
    private walletService: WalletService,
    private providerService: ProviderService,
    private notificationRepository: NotificationRepository
  ) {}

  async getCountries() {
    // Mock countries - in production, fetch from provider
    return [
      { iso2: "US", name: "United States", dialCode: "+1", flag: "🇺🇸" },
      { iso2: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧" },
      { iso2: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭" },
      { iso2: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪" },
      { iso2: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦" },
      { iso2: "IN", name: "India", dialCode: "+91", flag: "🇮🇳" },
      { iso2: "PH", name: "Philippines", dialCode: "+63", flag: "🇵🇭" },
    ];
  }

  async getProvidersByCountry(countryCode?: string) {
    // Mock providers
    const allProviders = [
      {
        id: "1",
        name: "AT&T",
        country: "US",
        countryCode: "US",
        operatorId: "ATT",
        logo: "",
      },
      {
        id: "2",
        name: "Verizon",
        country: "US",
        countryCode: "US",
        operatorId: "VZW",
        logo: "",
      },
      {
        id: "3",
        name: "Vodafone UK",
        country: "UK",
        countryCode: "GB",
        operatorId: "VFUK",
        logo: "",
      },
      {
        id: "4",
        name: "MTN Ghana",
        country: "Ghana",
        countryCode: "GH",
        operatorId: "MTNGH",
        logo: "",
      },
      {
        id: "5",
        name: "Safaricom",
        country: "Kenya",
        countryCode: "KE",
        operatorId: "SFCOM",
        logo: "",
      },
    ];

    if (countryCode) {
      return allProviders.filter(
        (p) => p.countryCode === countryCode.toUpperCase()
      );
    }

    return allProviders;
  }

  async getDataProducts(operatorId: string) {
    // Mock data products
    return [
      {
        id: "1",
        name: "1GB Daily",
        price: 500,
        validity: "1 Day",
        amount: "1GB",
      },
      {
        id: "2",
        name: "3GB Weekly",
        price: 1200,
        validity: "7 Days",
        amount: "3GB",
      },
      {
        id: "3",
        name: "10GB Monthly",
        price: 3500,
        validity: "30 Days",
        amount: "10GB",
      },
      {
        id: "4",
        name: "20GB Monthly",
        price: 6000,
        validity: "30 Days",
        amount: "20GB",
      },
    ];
  }

  async purchaseInternationalAirtime(data: {
    userId: string;
    countryCode: string;
    operatorId: string;
    phoneNumber: string;
    amount: number;
  }) {
    const reference = generateReference("INTAIR");

    // Get wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Check balance
    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct from wallet
    await this.walletService.debitWallet(
      data.userId,
      data.amount,
      "International airtime purchase",
      "main"
    );

    // Create transaction
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      type: "international_airtime",
      provider: "reloadly",
      remark: `International airtime: ${data.countryCode} ${data.phoneNumber}`,
      purpose: "international_airtime",
      status: "pending",
      meta: {
        countryCode: data.countryCode,
        operatorId: data.operatorId,
        phoneNumber: data.phoneNumber,
      },
    });

    // Call provider
    try {
      const providerResponse = {
        success: true,
        reference,
        providerReference: Date.now().toString(),
        message: "Data bundle purchase successful",
        data: {
          phone: data.phoneNumber,
          amount: data.amount,
        },
      };
      // await this.providerService.purchaseInternationalAirtime(data);

      const status = providerResponse.success ? "success" : "failed";
      await this.transactionRepository.updateStatus(transaction._id, status);

      await this.notificationRepository.create({
        type:
          status === "success" ? "transaction_success" : "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "International Airtime",
          amount: data.amount,
          reference,
          phoneNumber: data.phoneNumber,
        },
      });

      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "International airtime failed - refund",
          "main"
        );
      }

      return { ...transaction.toObject(), status, providerResponse };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction._id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "International airtime error - refund",
        "main"
      );

      await this.notificationRepository.create({
        type: "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "International Airtime",
          amount: data.amount,
          reference,
        },
      });

      throw error;
    }
  }

  async purchaseInternationalData(data: {
    userId: string;
    countryCode: string;
    operatorId: string;
    phoneNumber: string;
    productId: string;
    amount: number;
  }) {
    const reference = generateReference("INTDAT");

    // Get wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Check balance
    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct from wallet
    await this.walletService.debitWallet(
      data.userId,
      data.amount,
      "International data purchase",
      "main"
    );

    // Create transaction
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      type: "international_data",
      provider: "reloadly",
      remark: `International data: ${data.countryCode} ${data.phoneNumber}`,
      purpose: "international_data",
      status: "pending",
      meta: {
        countryCode: data.countryCode,
        operatorId: data.operatorId,
        phoneNumber: data.phoneNumber,
        productId: data.productId,
      },
    });

    // Call provider
    try {
      const providerResponse = {
        success: true,
        reference,
        providerReference: Date.now().toString(),
        message: "Data bundle purchase successful",
        data: {
          phone: data.phoneNumber,
          plan: data.productId,
          amount: data.amount,
        },
      };
      // await this.providerService.purchaseInternationalData(data);

      const status = providerResponse.success ? "success" : "failed";
      await this.transactionRepository.updateStatus(transaction._id, status);

      await this.notificationRepository.create({
        type:
          status === "success" ? "transaction_success" : "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "International Data",
          amount: data.amount,
          reference,
          phoneNumber: data.phoneNumber,
        },
      });

      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "International data failed - refund",
          "main"
        );
      }

      return { ...transaction.toObject(), status, providerResponse };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction._id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "International data error - refund",
        "main"
      );

      await this.notificationRepository.create({
        type: "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "International Data",
          amount: data.amount,
          reference,
        },
      });

      throw error;
    }
  }

  async getTransactionHistory(
    userId: string,
    type: "airtime" | "data",
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {
      sourceId: new Types.ObjectId(userId),
      type: type === "airtime" ? "international_airtime" : "international_data",
    };

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

    return this.transactionRepository.findWithFilters(query, page, limit);
  }
}
