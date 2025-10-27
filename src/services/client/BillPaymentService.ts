import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { ProductRepository } from "@/repositories/ProductRepository";
import { ProviderService } from "./ProviderService";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { AppError } from "@/middlewares/errorHandler";
import { generateReference } from "@/utils/helpers";
interface BillPaymentData {
  userId: string;
  productId: string;
  amount: number;
  phone?: string;
  phoneCode?: string;
  smartCardNumber?: string;
  meterNumber?: string;
  meterType?: string;

  // notc
  customerId?: string;
  providerId?: string;
}

export class BillPaymentService {
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  private productRepository: ProductRepository;
  private providerService: ProviderService;
  private notificationRepository?: NotificationRepository;
  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.productRepository = new ProductRepository();
    this.providerService = new ProviderService();
    this.notificationRepository = new NotificationRepository();
  }

  async purchaseAirtime(data: {
    userId: string;
    phone: string;
    phoneCode?: string;
    amount: number;
    providerId: string;
    serviceId: string;
  }) {
    const reference = generateReference();

    // Get user wallet
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
      "Airtime purchase",
      "main"
    );

    // Create transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      type: "airtime",
      provider: data.providerId,
      remark: `Airtime purchase for ${data.phone}`,
      purpose: "airtime_purchase",
      status: "pending",
      meta: { phone: data.phone, phoneCode: data.phoneCode },
    });

    // Call provider API
    try {
      const providerResponse = await this.providerService.purchaseAirtime({
        phone: data.phone,
        amount: data.amount,
        provider: data.providerId,
      });

      // Update transaction status
      const status = providerResponse.success ? "success" : "failed";
      await this.transactionRepository.updateStatus(transaction._id, status);

      // Send notification
      if (this.notificationRepository) {
        await this.notificationRepository.create({
          type:
            status === "success" ? "transaction_success" : "transaction_failed",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "Airtime",
            amount: data.amount,
            reference,
          },
        });
      }

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "Airtime purchase failed - refund",
          "main"
        );
      }

      return {
        ...transaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.transactionRepository.updateStatus(transaction._id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "Airtime purchase error - refund",
        "main"
      );
      throw error;
    }
  }

  async purchaseData(data: {
    userId: string;
    phone: string;
    phoneCode?: string;
    productId: string;
    amount: number;
  }) {
    const reference = generateReference();

    // Get product
    const product = await this.productRepository.findById(data.productId);
    if (!product || !product.active) {
      throw new AppError(
        "Product not found or inactive",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Get user wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Check balance
    const totalAmount = data.amount;
    if (wallet.balance < totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct from wallet
    await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "Data bundle purchase",
      "main"
    );

    // Create transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "Product",
      transactableId: product.id,
      reference,
      amount: totalAmount,
      type: "data",
      provider: product.providerId.toString(),
      remark: `Data purchase: ${product.name} for ${data.phone}`,
      purpose: "data_purchase",
      status: "pending",
      meta: {
        phone: data.phone,
        phoneCode: data.phoneCode,
        productName: product.name,
      },
    });

    // Call provider API
    try {
      const providerResponse = await this.providerService.purchaseData({
        phone: data.phone,
        amount: data.amount,
        provider: product.providerId.toString(),
        plan: product.name,
      });

      // Update transaction status
      const status = providerResponse.success ? "success" : "failed";
      await this.transactionRepository.updateStatus(transaction._id, status);

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "Data purchase failed - refund",
          "main"
        );
      }

      return {
        ...transaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.transactionRepository.updateStatus(transaction._id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "Data purchase error - refund",
        "main"
      );
      throw error;
    }
  }

  async purchaseCableTv(data: {
    userId: string;
    smartCardNumber: string;
    productId: string;
    amount: number;
  }) {
    const reference = generateReference();

    // Get product
    const product = await this.productRepository.findById(data.productId);
    if (!product || !product.active) {
      throw new AppError(
        "Product not found or inactive",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Get user wallet
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
      "Cable TV subscription",
      "main"
    );

    // Create transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "Product",
      transactableId: product.id,
      reference,
      amount: data.amount,
      type: "cable_tv",
      provider: product.providerId.toString(),
      remark: `Cable TV: ${product.name} for ${data.smartCardNumber}`,
      purpose: "cable_tv_subscription",
      status: "pending",
      meta: {
        smartCardNumber: data.smartCardNumber,
        productName: product.name,
      },
    });

    // Call provider API
    try {
      const providerResponse = await this.providerService.purchaseCableTv({
        smartCardNumber: data.smartCardNumber,
        amount: data.amount,
        provider: product.providerId.toString(),
        package: product.name,
      });

      // Update transaction status
      const status = providerResponse.success ? "success" : "failed";
      await this.transactionRepository.updateStatus(transaction._id, status);

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "Cable TV subscription failed - refund",
          "main"
        );
      }

      return {
        ...transaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.transactionRepository.updateStatus(transaction._id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "Cable TV subscription error - refund",
        "main"
      );
      throw error;
    }
  }

  async purchaseElectricity(data: {
    userId: string;
    meterNumber: string;
    productId: string;
    amount: number;
    meterType: string;
  }) {
    const reference = generateReference();

    // Get product
    const product = await this.productRepository.findById(data.productId);
    if (!product || !product.active) {
      throw new AppError(
        "Product not found or inactive",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Get user wallet
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
      "Electricity bill payment",
      "main"
    );

    // Create transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "Product",
      transactableId: product.id,
      reference,
      amount: data.amount,
      type: "electricity",
      provider: product.providerId.toString(),
      remark: `Electricity: ${product.name} for ${data.meterNumber}`,
      purpose: "electricity_payment",
      status: "pending",
      meta: {
        meterNumber: data.meterNumber,
        meterType: data.meterType,
        productName: product.name,
      },
    });

    // Call provider API
    try {
      const providerResponse = await this.providerService.purchaseElectricity({
        meterNumber: data.meterNumber,
        amount: data.amount,
        provider: product.providerId.toString(),
        meterType: data.meterType,
      });

      // Update transaction status
      const status = providerResponse.success ? "success" : "failed";
      await this.transactionRepository.updateStatus(transaction._id, status);

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "Electricity payment failed - refund",
          "main"
        );
      }

      return {
        ...transaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.transactionRepository.updateStatus(transaction._id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "Electricity payment error - refund",
        "main"
      );
      throw error;
    }
  }

  async getBillPaymentTransactions(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {
      sourceId: userId,
      type: {
        $in: ["airtime", "data", "cable_tv", "electricity", "betting", "e_pin"],
      },
    };

    if (filters.type) {
      query.type = filters.type;
    }

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

    return this.transactionRepository.findWithPagination(query, page, limit);
  }

  // Airtime methods
  async getAirtimeProviders() {
    return {};
    // this.providerService.getProvidersByService("airtime");
  }

  async verifyPhone(phone: string) {
    // Mock verification - implement actual provider verification
    return {
      valid: true,
      phone,
      network: "MTN", // Detect network from phone
    };
  }

  async getAirtimeHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "airtime" },
      page,
      limit
    );
  }

  async bulkPurchaseAirtime(data: any) {
    const { userId, recipients } = data;
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.purchaseAirtime({
          userId,
          phone: recipient.phone,
          amount: recipient.amount,
          providerId: data.providerId,
          serviceId: data.serviceId,
        });
        results.push({ ...recipient, status: "success", result });
      } catch (error: any) {
        results.push({ ...recipient, status: "failed", error: error.message });
      }
    }

    return { total: recipients.length, results };
  }

  // Data methods
  async getDataServices(type?: string) {
    const services = [{}];
    // await this.providerService.getProvidersByService("data");
    if (type) {
      return services.filter((s: any) => s.type === type);
    }
    return services;
  }

  async getDataProducts(type: string, service: string) {
    return {};
    // this.productRepository.findByService(service);
  }

  async getDataHistory(userId: string, page: number = 1, limit: number = 10) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "data" },
      page,
      limit
    );
  }

  async bulkPurchaseData(data: any) {
    const { userId, recipients } = data;
    const results = [];

    for (const recipient of recipients) {
      try {
        const result = await this.purchaseData({
          userId,
          phone: recipient.phone,
          productId: recipient.productId,
          amount: recipient.amount,
        });
        results.push({ ...recipient, status: "success", result });
      } catch (error: any) {
        results.push({ ...recipient, status: "failed", error: error.message });
      }
    }

    return { total: recipients.length, results };
  }

  // Betting methods
  async getBettingProviders() {
    return {};
    // this.providerService.getProvidersByService("betting");
  }

  async verifyBettingAccount(data: any) {
    const { customerId, providerId } = data;
    // Mock verification - implement actual provider verification
    return {
      valid: true,
      customerId,
      customerName: "John Doe",
    };
  }

  async fundBetting(data: BillPaymentData) {
    const { userId, customerId, amount, providerId } = data;
    const reference = generateReference("BET");

    try {
      await this.walletService.debitWallet(
        userId,
        amount,
        "Betting funding"
        // reference,
      );

      const transaction = await this.transactionRepository.create({
        reference,
        sourceId: new Types.ObjectId(userId),
        amount,
        type: "betting",
        provider: providerId,
        status: "pending",
        meta: { customerId },
      });

      try {
        const providerResult = {};
        // await this.providerService.processBetting({
        //   customerId,
        //   amount,
        //   reference,
        // });

        await this.transactionRepository.updateStatus(
          transaction._id,
          "success"
        );

        if (this.notificationRepository) {
          await this.notificationRepository.create({
            // notifiableId:new Types.ObjectId(userId),
            // title: "Betting Account Funded",
            // message: `Your betting account has been funded with ₦${amount}`,
            // type: "transaction",
          });
        }

        return { reference, status: "success", ...providerResult };
      } catch (error: any) {
        await this.transactionRepository.updateStatus(
          transaction._id,
          "failed"
        );
        // await this.walletService.refund(
        //   userId,
        //   amount,
        //   reference,
        //   "Betting funding refund"
        // );
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }

  async getBettingHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "betting" },
      page,
      limit
    );
  }

  // E-Pin methods
  async getEPinServices() {
    // return this.providerService.getProvidersByService("epin");
  }

  async getEPinProducts(service: string) {
    // return this.productRepository.findByService(service);
  }

  async verifyEPinMerchant(data: any) {
    // Mock verification
    return {
      valid: true,
      merchantId: data.merchantId,
      merchantName: "Merchant Name",
    };
  }

  async purchaseEPin(data: BillPaymentData) {
    const { userId, amount, productId } = data;
    const reference = generateReference("EPIN");

    try {
      const product = await this.productRepository.findById(productId!);
      if (!product) {
        throw new AppError(
          "Product not found",
          HTTP_STATUS.NOT_FOUND,
          ERROR_CODES.NOT_FOUND
        );
      }

      await this.walletService.debitWallet(
        userId,
        amount,
        // reference,
        "E-Pin purchase"
      );

      const transaction = await this.transactionRepository.create({
        reference,
        // sourceId: userId,
        amount,
        type: "e_pin",
        // provider: product.provider,
        status: "pending",
        meta: { productId },
      });

      try {
        const providerResult =
          // await this.providerService.processEPin({
          //   productId,
          //   amount,
          //   reference,
          // });

          await this.transactionRepository.updateStatus(
            transaction._id,
            "success"
          );

        if (this.notificationRepository) {
          await this.notificationRepository.create({
            // userId,
            // title: "E-Pin Purchase Successful",
            // message: `Your E-Pin has been generated successfully`,
            // type: "transaction",
          });
        }

        return { reference, status: "success", ...providerResult };
      } catch (error: any) {
        await this.transactionRepository.updateStatus(
          transaction._id,
          "failed"
        );
        // await this.walletService.refund(
        //   userId,
        //   amount,
        //   reference,
        //   "E-Pin purchase refund"
        // );
        throw error;
      }
    } catch (error) {
      throw error;
    }
  }

  async getEPinHistory(userId: string, page: number = 1, limit: number = 10) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "e_pin" },
      page,
      limit
    );
  }

  // Electricity methods
  async getElectricityProviders() {
    return {};
    // this.providerService.getProvidersByService("electricity");
  }

  async verifyMeterNumber(data: any) {
    const { meterNumber, meterType, providerId } = data;
    // Mock verification - implement actual provider verification
    return {
      valid: true,
      meterNumber,
      customerName: "John Doe",
      address: "123 Main Street",
    };
  }

  async getElectricityHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "electricity" },
      page,
      limit
    );
  }
}
