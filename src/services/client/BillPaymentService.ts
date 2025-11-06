import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { ProductRepository } from "@/repositories/ProductRepository";
import { ProviderService } from "./ProviderService";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { AppError } from "@/middlewares/errorHandler";
import { generateReference } from "@/utils/helpers";
import { Product } from "@/models/reference/Product";
import { IUser } from "@/models/core/User";
import { ServiceRepository } from "@/repositories/ServiceRepository";
import logger from "@/logger";

interface BettingData {
  userId: string;
  customerId: string;
  amount: number;
  providerId: string;
  reference?: string;
}

export class BillPaymentService {
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  private productRepository: ProductRepository;
  private providerService: ProviderService;
  private notificationRepository?: NotificationRepository;
  private serviceRepository: ServiceRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.productRepository = new ProductRepository();
    this.providerService = new ProviderService();
    this.notificationRepository = new NotificationRepository();
    this.serviceRepository = new ServiceRepository();
  }

  /**
   * AIRTIME METHODS
   */
  async purchaseAirtime(data: {
    userId: string;
    phone: string;
    amount: number;
    network: string;
  }) {
    const reference = generateReference("AIRTIME_");

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      data.userId,
      data.amount,
      "Airtime purchase",
      "main"
    );

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      type: "airtime",
      provider: "vtpass",
      remark: `Airtime purchase for ${data.phone}`,
      purpose: "airtime_purchase",
      direction: "DEBIT",
      status: "pending",
      meta: {
        phone: data.phone,
        network: data.network,
      },
    });

    try {
      const providerResponse = await this.providerService.purchaseAirtime({
        phone: data.phone,
        amount: data.amount,
        network: data.network,
        reference,
      });

      // Determine transaction status based on provider response
      let status: "success" | "pending" | "failed";

      if (providerResponse.success) {
        status = "success";
      } else if (providerResponse.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      const result = await this.transactionRepository.update(transaction.id, {
        status,
        providerReference: providerResponse.providerReference,
      });

      // Send notification for success
      if (this.notificationRepository && status === "success") {
        await this.notificationRepository.create({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "Airtime",
            amount: data.amount,
            reference,
          },
        });
      }

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "Airtime purchase failed - refund",
          "main"
        );

        if (this.notificationRepository) {
          await this.notificationRepository.create({
            type: "transaction_failed",
            notifiableType: "User",
            notifiableId: new Types.ObjectId(data.userId),
            data: {
              transactionType: "Airtime",
              amount: data.amount,
              reference,
            },
          });
        }
      }

      return {
        result,
        providerStatus: providerResponse.status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "Airtime purchase error - refund",
        "main"
      );
      throw error;
    }
  }

  async getAirtimeProviders() {
    return this.providerService.getServicesByServiceTypeCode("airtime");
  }

  async getDataProviders() {
    return this.providerService.getServicesByServiceTypeCode("data");
  }

  async verifyPhone(phone: string) {
    // Detect network from phone number
    const firstDigit = phone.replace(/\D/g, "").substring(0, 4);
    const networkMap: { [key: string]: string } = {
      "0803": "MTN",
      "0806": "MTN",
      "0810": "MTN",
      "0813": "MTN",
      "0814": "MTN",
      "0816": "MTN",
      "0903": "MTN",
      "0906": "MTN",
      "0805": "GLO",
      "0807": "GLO",
      "0811": "GLO",
      "0815": "GLO",
      "0905": "GLO",
      "0802": "AIRTEL",
      "0808": "AIRTEL",
      "0812": "AIRTEL",
      "0901": "AIRTEL",
      "0902": "AIRTEL",
      "0809": "9MOBILE",
      "0817": "9MOBILE",
      "0818": "9MOBILE",
      "0908": "9MOBILE",
      "0909": "9MOBILE",
    };

    const network = networkMap[firstDigit] || "UNKNOWN";

    return {
      valid: phone.length >= 11,
      phone,
      network,
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

  /**
   * INTERNATIONAL AIRTIME METHODS
   */
  async getInternationalAirtimeCountries() {
    return this.providerService.getInternationalAirtimeCountries();
  }

  async getInternationalAirtimeProviders(countryCode?: string) {
    return this.providerService.getInternationalAirtimeProviders(countryCode);
  }

  async getInternationalAirtimeProducts(
    providerId: string,
    productTypeId: number
  ) {
    return this.providerService.getInternationalAirtimeVariations(
      providerId,
      productTypeId
    );
  }

  async purchaseInternationalAirtime(data: {
    userId: string;
    phone: string;
    amount: number;
    countryCode: string;
    operatorId: string;
    email: string;
    productCode: string;
  }) {
    const reference = generateReference("INT_AIRTIME");

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      data.userId,
      data.amount,
      "International airtime purchase",
      "main"
    );

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      type: "internationalAirtime",
      provider: "vtpass",
      remark: `International airtime purchase for ${data.phone}`,
      purpose: "internationalAirtime_purchase",
      direction: "DEBIT",
      status: "pending",
      meta: {
        phone: data.phone,
        countryCode: data.countryCode,
        operatorId: data.operatorId,
        email: data.email,
      },
    });

    try {
      const providerResponse =
        await this.providerService.purchaseInternationalAirtime({
          phone: data.phone,
          amount: data.amount,
          countryCode: data.countryCode,
          operatorId: data.operatorId,
          reference,
          variationCode: data.productCode,
          email: "",
        });

      let status: "success" | "pending" | "failed";

      if (providerResponse.success) {
        status = "success";
      } else if (providerResponse.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      const result = await this.transactionRepository.update(transaction.id, {
        status,
        providerReference: providerResponse.providerReference,
      });

      if (this.notificationRepository && status === "success") {
        await this.notificationRepository.create({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "International Airtime",
            amount: data.amount,
            reference,
          },
        });
      }

      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "International airtime purchase failed - refund",
          "main"
        );

        if (this.notificationRepository) {
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
        }
      }

      return {
        result,
        providerStatus: providerResponse.status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "International airtime purchase error - refund",
        "main"
      );
      throw error;
    }
  }

  async getInternationalAirtimeHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "internationalAirtime" },
      page,
      limit
    );
  }
  /**
   * DATA METHODS
   */
  async purchaseData(data: {
    userId: string;
    phone: string;
    productId: string;
  }) {
    const reference = generateReference("DATA_");

    // Fetch product with service details
    const product = await Product.findById(data.productId).populate({
      path: "serviceId",
      select: "name code serviceTypeId isActive",
      populate: {
        path: "serviceTypeId",
        select: "code name isActive",
      },
    });

    if (!product || !product.isActive) {
      throw new AppError(
        "Product not found or inactive",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Check if service is active
    const service = product.serviceId as any;
    if (!service || !service.isActive) {
      throw new AppError(
        "Service is currently unavailable",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }

    // Check if service type is active
    if (!service.serviceTypeId?.isActive) {
      throw new AppError(
        "This service type is currently unavailable",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    const totalAmount = product.amount;
    if (wallet.balance < totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "Data bundle purchase",
      "main"
    );

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "Product",
      transactableId: product.id,
      reference,
      amount: totalAmount,
      direction: "DEBIT",
      type: "data",
      remark: `Data purchase: ${product.name} for ${data.phone}`,
      purpose: "data_purchase",
      provider: "vtpass",
      status: "pending",
      meta: {
        phone: data.phone,
        productName: product.name,
        serviceCode: service.code,
        serviceName: service.name,
      },
    });

    try {
      const providerResponse = await this.providerService.purchaseData({
        phone: data.phone,
        amount: product.amount,
        plan: product.name,
        serviceCode: service.code,
        productCode: product.code,
        reference,
      });

      // Determine transaction status based on provider response
      let status: "success" | "pending" | "failed";

      if (providerResponse.success) {
        status = "success";
      } else if (providerResponse.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      const result = await this.transactionRepository.update(transaction.id, {
        status,
        providerReference: providerResponse.providerReference,
      });

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "Data purchase failed - refund",
          "main"
        );
      }

      return {
        result,
        providerStatus: providerResponse.status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "Data purchase error - refund",
        "main"
      );
      throw error;
    }
  }

  async getDataProducts(serviceId: string, dataType?: string) {
    return this.providerService.getProductsByService(serviceId, dataType);
  }

  async getData() {
    return this.providerService.getProductsByServiceTypeCode("data");
  }

  async getDataHistory(userId: string, page: number = 1, limit: number = 10) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "data" },
      page,
      limit
    );
  }

  /**
   * INTERNATIONAL DATA METHODS
   */
  async getInternationalDataCountries() {
    return this.providerService.getInternationalDataCountries();
  }

  async getInternationalDataProviders(countryCode?: string) {
    return this.providerService.getInternationalDataProviders(countryCode);
  }

  async getInternationalDataProducts(operator: string) {
    return this.providerService.getInternationalDataProducts(operator);
  }

  async purchaseInternationalData(data: {
    userId: string;
    phone: string;
    productCode: string;
    operatorId: string;
    countryCode: string;
    amount: number;
    email: string;
  }) {
    const reference = generateReference("INT_DATA");

    // Fetch product details from provider or database
    // const productDetails =
    //   await this.providerService.getInternationalDataProductDetails(
    //     data.productId,
    //     data.operator
    //   );

    // if (!productDetails) {
    //   throw new AppError(
    //     "Product not found",
    //     HTTP_STATUS.NOT_FOUND,
    //     ERROR_CODES.RESOURCE_NOT_FOUND
    //   );
    // }

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    const totalAmount = data.amount;
    if (wallet.balance < totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "International data purchase",
      "main"
    );

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: totalAmount,
      direction: "DEBIT",
      type: "internationalData",
      remark: `International data  for ${data.phone}`,
      purpose: "internationalData_purchase",
      provider: "vtpass",
      status: "pending",
      meta: {
        phone: data.phone,
        productCode: data.productCode,
        operatorId: data.operatorId,
        countryCode: data.countryCode,
      },
    });

    try {
      const providerResponse =
        await this.providerService.purchaseInternationalData({
          phone: data.phone,
          variationCode: data.productCode,
          operatorId: data.operatorId,
          countryCode: data.countryCode,
          amount: totalAmount,
          reference,
          email: data.email,
        });

      let status: "success" | "pending" | "failed";

      if (providerResponse.success) {
        status = "success";
      } else if (providerResponse.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      const result = await this.transactionRepository.update(transaction.id, {
        status,
        providerReference: providerResponse.providerReference,
      });

      if (this.notificationRepository && status === "success") {
        await this.notificationRepository.create({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "International Data",
            amount: totalAmount,
            reference,
          },
        });
      }

      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "International data purchase failed - refund",
          "main"
        );

        if (this.notificationRepository) {
          await this.notificationRepository.create({
            type: "transaction_failed",
            notifiableType: "User",
            notifiableId: new Types.ObjectId(data.userId),
            data: {
              transactionType: "International Data",
              amount: totalAmount,
              reference,
            },
          });
        }
      }

      return {
        result,
        providerStatus: providerResponse.status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "International data purchase error - refund",
        "main"
      );
      throw error;
    }
  }

  async getInternationalDataHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "internationalData" },
      page,
      limit
    );
  }

  /**
   * CABLE TV METHODS
   */
  async purchaseCableTv(data: {
    userId: string;
    user: IUser;
    provider: string;
    smartCardNumber: string;
    productId: string;
    type: "renew" | "change";
  }) {
    const reference = generateReference("CABLE_");

    // Fetch product with service details
    const product = await Product.findById(data.productId).populate({
      path: "serviceId",
      select: "name code serviceTypeId isActive",
      populate: {
        path: "serviceTypeId",
        select: "code name isActive",
      },
    });

    if (!product || !product.isActive) {
      throw new AppError(
        "Product not found or inactive",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    const service = product.serviceId as any;
    if (!service || !service.isActive || !service.serviceTypeId?.isActive) {
      throw new AppError(
        "Service is currently unavailable",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (wallet.balance < product.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      data.userId,
      product.amount,
      "Cable TV subscription",
      "main"
    );

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "Product",
      transactableId: product.id,
      reference,
      amount: product.amount,
      direction: "DEBIT",
      type: "cable_tv",
      remark: `Cable TV: ${product.name} for ${data.smartCardNumber}`,
      purpose: "cable_tv_subscription",
      status: "pending",
      meta: {
        smartCardNumber: data.smartCardNumber,
        productName: product.name,
        serviceCode: service.code,
        serviceName: service.name,
        subscriptionType: data.type,
      },
    });

    try {
      const providerResponse = await this.providerService.purchaseCableTv({
        reference,
        provider: data.provider || service.code,
        smartCardNumber: data.smartCardNumber,
        amount: product.amount,
        phone: data.user.phone || "",
        package: product.code,
        subscriptionType: data.type,
      });

      // Determine transaction status based on provider response
      let status: "success" | "pending" | "failed";

      if (providerResponse.success) {
        status = "success";
      } else if (providerResponse.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      await this.transactionRepository.updateStatus(transaction.id, status);

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          product.amount,
          "Cable TV subscription failed - refund",
          "main"
        );
      }

      return {
        ...transaction.toObject(),
        status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        product.amount,
        "Cable TV subscription error - refund",
        "main"
      );
      throw error;
    }
  }

  async getCableTvProviders() {
    return this.providerService.getServicesByServiceTypeCode("cable_tv");
  }

  async getCableTvProducts(serviceId: string) {
    return this.providerService.getProductsByService(serviceId);
  }

  async verifyCableSmartCard(smartCardNumber: string, serviceCode: string) {
    return this.providerService.verifySmartCard(smartCardNumber, serviceCode);
  }

  async getCableTvHistory(
    userId: string,
    page: number = 1,
    limit: number = 10
  ) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "cable_tv" },
      page,
      limit
    );
  }

  /**
   * ELECTRICITY METHODS
   */
  async purchaseElectricity(data: {
    userId: string;
    meterNumber: string;
    providerId: string;
    amount: number;
    meterType: string;
    phone: string;
  }) {
    const reference = generateReference("ELECTRICITY_");

    const service = await this.serviceRepository.findByIdAndPopulateType(
      data.providerId
    );
    // console.log(service);
    const serviceType = service?.serviceTypeId as any;

    if (!service || !service.isActive || !serviceType.isActive) {
      throw new AppError(
        "Service is currently unavailable",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      data.userId,
      data.amount,
      "Electricity bill payment",
      "main"
    );

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "Product",
      transactableId: service.id,
      reference,
      amount: data.amount,
      direction: "DEBIT",
      type: "electricity",
      remark: `Electricity: ${service.name} for ${data.meterNumber}`,
      purpose: "electricity_payment",
      status: "pending",
      meta: {
        meterNumber: data.meterNumber,
        meterType: data.meterType,
        serviceCode: service.code,
        serviceName: service.name,
      },
    });

    try {
      const providerResponse = await this.providerService.purchaseElectricity({
        reference,
        meterNumber: data.meterNumber,
        amount: data.amount,
        provider: service.code,
        meterType: data.meterType,
        productCode: service.code,
        phone: data.phone,
      });

      // Determine transaction status based on provider response
      let status: "success" | "pending" | "failed";

      if (providerResponse.success) {
        status = "success";
      } else if (providerResponse.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      await this.transactionRepository.updateStatus(transaction.id, status);

      // Refund for failed transactions only
      if (status === "failed") {
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
        // providerResponse,
        token: providerResponse.token,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "Electricity payment error - refund",
        "main"
      );
      throw error;
    }
  }

  async getElectricityProviders() {
    return this.providerService.getServicesByServiceTypeCode("electricity");
  }

  async getElectricityProducts(serviceId: string) {
    return this.providerService.getProductsByService(serviceId);
  }

  async verifyMeterNumber(data: {
    meterNumber: string;
    serviceCode: string;
    meterType: string;
  }) {
    return this.providerService.verifyMeterNumber(
      data.meterNumber,
      data.serviceCode,
      data.meterType
    );
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

  /**
   * BETTING METHODS
   */
  async fundBetting(data: BettingData) {
    const { userId, customerId, amount, providerId } = data;
    const reference = generateReference("BET");

    const wallet = await this.walletService.getWallet(userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    if (wallet.balance < amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      userId,
      amount,
      "Betting funding",
      "main"
    );

    const service = await this.serviceRepository.findById(providerId);

    if (!service) {
      throw new AppError(
        "Service not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const serviceCode = service.code;

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      reference,
      sourceId: new Types.ObjectId(userId),
      amount,
      type: "betting",
      // provider: ""
      direction: "DEBIT",
      purpose: "betting_funding",
      remark: `Betting funding for ${service.name} for ${customerId}`,
      status: "pending",
      meta: { customerId, serviceCode },
    });

    try {
      const providerResult = await this.providerService.fundBetting({
        customerId: customerId!,
        amount,
        provider: serviceCode,
      });

      // Determine transaction status based on provider response
      let status: "success" | "pending" | "failed";

      if (providerResult.success) {
        status = "success";
      } else if (providerResult.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      await this.transactionRepository.updateStatus(transaction.id, status);

      if (this.notificationRepository && status === "success") {
        await this.notificationRepository.create({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(userId),
          data: {
            transactionType: "Betting",
            amount,
            reference,
          },
        });
      }

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          userId,
          amount,
          "Betting funding failed - refund",
          "main"
        );
      }

      return { status, ...providerResult, pending: status === "pending" };
    } catch (error: any) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        userId,
        amount,
        "Betting funding error - refund",
        "main"
      );
      throw error;
    }
  }

  async getBettingProviders() {
    return this.providerService.getServicesByServiceTypeCode("betting");
  }

  async verifyBettingAccount(data: { customerId: string; providerId: string }) {
    const service = await this.serviceRepository.findById(data.providerId);

    if (!service) {
      throw new AppError(
        "Service not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const result = this.providerService.verifyClubKonnectBettingCustomer(
      data.customerId,
      service.code
    );
    // Mock verification - implement actual provider verification if available
    return result;
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

  /**
   * E-PIN METHODS
   */
  async getEPinServices() {
    return this.providerService.getServicesByServiceTypeCode("education");
  }

  async getEPinProducts(serviceId: string) {
    return this.providerService.getProductsByService(serviceId);
  }

  async purchaseEPin(data: {
    userId: string;
    user: IUser;
    productId: string;
    profileId: string;
  }) {
    const reference = generateReference("EPIN_");

    const product = await Product.findById(data.productId).populate({
      path: "serviceId",
      select: "name code serviceTypeId isActive",
      populate: {
        path: "serviceTypeId",
        select: "code name isActive",
      },
    });

    if (!product || !product.isActive) {
      throw new AppError(
        "Product not found or inactive",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    const service = product.serviceId as any;
    if (!service || !service.isActive || !service.serviceTypeId?.isActive) {
      throw new AppError(
        "Service is currently unavailable",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.SERVICE_UNAVAILABLE
      );
    }

    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    const totalAmount = product.amount;
    if (wallet.balance < totalAmount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "E-Pin purchase",
      "main"
    );

    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "Product",
      transactableId: product.id,
      reference,
      amount: totalAmount,
      direction: "DEBIT",
      type: "e_pin",
      remark: `E-Pin: ${product.name} for Profile ${data.profileId}`,
      purpose: "e_pin_purchase",
      status: "pending",
      meta: {
        productName: product.name,
        serviceCode: service.code,
        serviceName: service.name,
        profileId: data.profileId,
        phone: data.user.phone,
      },
    });

    try {
      const providerResponse = await this.providerService.purchaseEducation({
        profileId: data.profileId,
        variationCode: product.code,
        phone: data.user.phone!,
        amount: product.amount,
        reference,
      });

      let status: "success" | "pending" | "failed";

      if (providerResponse.success) {
        status = "success";
      } else if (providerResponse.pending) {
        status = "pending";
      } else {
        status = "failed";
      }

      await this.transactionRepository.update(transaction.id, {
        status,
        providerReference: providerResponse.providerReference,
      });

      if (this.notificationRepository && status === "success") {
        await this.notificationRepository.create({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "E-Pin",
            amount: totalAmount,
            reference,
            pin: providerResponse.token,
          },
        });
      }

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "E-Pin purchase failed - refund",
          "main"
        );

        if (this.notificationRepository) {
          await this.notificationRepository.create({
            type: "transaction_failed",
            notifiableType: "User",
            notifiableId: new Types.ObjectId(data.userId),
            data: {
              transactionType: "E-Pin",
              amount: totalAmount,
              reference,
            },
          });
        }
      }

      return {
        ...transaction.toObject(),
        status,
        // providerResponse,
        pin: providerResponse.token,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "E-Pin purchase error - refund",
        "main"
      );
      throw error;
    }
  }

  async verifyEPinProfile(data: { number: string; type: string }) {
    return this.providerService.verifyJambProfile(data.number, data.type);
  }

  async getEPinHistory(userId: string, page: number = 1, limit: number = 10) {
    return this.transactionRepository.findWithPagination(
      { sourceId: userId, type: "e_pin" },
      page,
      limit
    );
  }

  /**
   * GENERAL METHODS
   */
  async getBillPaymentTransactions(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {
      sourceId: userId,
      type: {
        $in: [
          "airtime",
          "data",
          "cable_tv",
          "electricity",
          "betting",
          "education",
          "internationalAirtime",
          "internationalData",
        ],
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
}
