import { TransactionRepository } from "@/repositories/TransactionRepository";
import { WalletService } from "./WalletService";
import { ProviderService } from "./ProviderService";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { AppError } from "@/middlewares/errorHandler";
import { generateReference } from "@/utils/helpers";
import { Product } from "@/models/reference/Product";
import { IUser } from "@/models/core/User";
import { ServiceRepository } from "@/repositories/ServiceRepository";
import logger from "@/logger";
import { NotificationService } from "./NotificationService";
import { TransactionMapper } from "@/utils/TransactionMapper";

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
  private providerService: ProviderService;
  private serviceRepository: ServiceRepository;
  private notificationService: NotificationService;

  constructor() {
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.providerService = new ProviderService();
    this.serviceRepository = new ServiceRepository();
    this.notificationService = new NotificationService();
  }

  // AIRTIME METHODS

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

    const service = await this.serviceRepository.findByCode(data.network);
    if (!service) {
      throw new AppError(
        "Service Not Found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (wallet.balance < data.amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      data.amount,
      "Airtime purchase",
      "main",
      {
        type: "airtime",
        provider: service.name,
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        meta: {
          phone: data.phone,
          network: data.network,
          serviceCode: service.code,
          serviceName: service.name,
          logo: service.logo || "",
        },
      }
    );

    const transaction = debitResult.transaction;

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
        provider: providerResponse.providerCode,
        providerReference: providerResponse.providerReference,
      });

      if (status === "pending" && providerResponse.providerReference) {
        await this.initializePolling(
          transaction.id,
          providerResponse.providerReference,
          providerResponse.providerCode
        );
      }

      // Send notification for success
      if (status === "success") {
        await this.notificationService.createNotification({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "Airtime",
            amount: data.amount,
            reference,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "Airtime purchase failed - refund",
          "main",
          {
            type: "refund",
            provider: service.name,
            providerReference: providerResponse.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
            },
          }
        );

        await this.notificationService.createNotification({
          type: "transaction_failed",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "Airtime",
            amount: data.amount,
            reference,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      return {
        result: TransactionMapper.toDTO(result),
        providerStatus: providerResponse.status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "Airtime purchase error - refund",
        "main",
        {
          type: "refund",
          provider: service.name,
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: { originalReference: reference, reason: "error" },
        }
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
    const cleaned = phone.replace(/\D/g, "");

    const prefix = cleaned.substring(0, 4);

    const networkMap: { [key: string]: string } = {
      "0803": "MTN",
      "0806": "MTN",
      "0703": "MTN",
      "0706": "MTN",
      "0810": "MTN",
      "0813": "MTN",
      "0814": "MTN",
      "0816": "MTN",
      "0903": "MTN",
      "0906": "MTN",
      "0913": "MTN",
      "0916": "MTN",
      "0704": "MTN",

      // GLO
      "0805": "GLO",
      "0807": "GLO",
      "0705": "GLO",
      "0815": "GLO",
      "0811": "GLO",
      "0905": "GLO",
      "0915": "GLO",

      // AIRTEL
      "0802": "AIRTEL",
      "0808": "AIRTEL",
      "0708": "AIRTEL",
      "0812": "AIRTEL",
      "0701": "AIRTEL",
      "0902": "AIRTEL",
      "0901": "AIRTEL",
      "0904": "AIRTEL",
      "0907": "AIRTEL",
      "0912": "AIRTEL",

      "0809": "9MOBILE",
      "0817": "9MOBILE",
      "0818": "9MOBILE",
      "0908": "9MOBILE",
      "0909": "9MOBILE",
      // "0901": "9MOBILE",
    };

    const network = networkMap[prefix] || "UNKNOWN";

    const isValid = cleaned.length === 11 && cleaned.startsWith("0");

    return {
      valid: isValid,
      phone: cleaned,
      network,
    };
  }

  async verifyPhoneWithNetwork(
    phone: string,
    network: string
  ): Promise<boolean> {
    const networkCode = this.getNetworkCode(network);
    const cleaned = phone.replace(/\D/g, "");

    // Extract first 4 digits for matching
    const prefix = cleaned.substring(0, 4);

    const networkMap: { [key: string]: string } = {
      // MTN (more comprehensive)
      "0803": "MTN",
      "0806": "MTN",
      "0703": "MTN",
      "0706": "MTN",
      "0810": "MTN",
      "0813": "MTN",
      "0814": "MTN",
      "0816": "MTN",
      "0903": "MTN",
      "0906": "MTN",
      "0913": "MTN",
      "0916": "MTN",
      "0704": "MTN",

      // GLO
      "0805": "GLO",
      "0807": "GLO",
      "0705": "GLO",
      "0815": "GLO",
      "0811": "GLO",
      "0905": "GLO",
      "0915": "GLO",

      // AIRTEL
      "0802": "AIRTEL",
      "0808": "AIRTEL",
      "0708": "AIRTEL",
      "0812": "AIRTEL",
      "0701": "AIRTEL",
      "0902": "AIRTEL",
      "0901": "AIRTEL",
      "0904": "AIRTEL",
      "0907": "AIRTEL",
      "0912": "AIRTEL",

      // 9MOBILE (formerly Etisalat)
      "0809": "9MOBILE",
      "0817": "9MOBILE",
      "0818": "9MOBILE",
      "0908": "9MOBILE",
      "0909": "9MOBILE",
      // "0901": "9MOBILE",
    };

    const detectedNetwork = networkMap[prefix] || "UNKNOWN";

    const isValid = cleaned.length === 11 && cleaned.startsWith("0");

    const networkMatches =
      detectedNetwork.toUpperCase() === networkCode.toUpperCase();

    if (!networkMatches) {
      throw new AppError(
        `Phone number does not match network: ${network}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return isValid && networkMatches;
  }

  // INTERNATIONAL AIRTIME METHODS

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

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      data.amount,
      "International airtime purchase",
      "main",
      {
        type: "internationalAirtime",
        provider: "vtpass",
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        meta: {
          phone: data.phone,
          countryCode: data.countryCode,
          operatorId: data.operatorId,
          email: data.email,
        },
      }
    );

    const transaction = debitResult.transaction;

    try {
      const providerResponse =
        await this.providerService.purchaseInternationalAirtime({
          phone: data.phone,
          amount: data.amount,
          countryCode: data.countryCode,
          operatorId: data.operatorId,
          reference,
          variationCode: data.productCode,
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
        provider: providerResponse.providerCode,
        providerReference: providerResponse.providerReference,
      });

      if (status === "success") {
        await this.notificationService.createNotification({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "International Airtime",
            amount: data.amount,
            reference,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "International airtime purchase failed - refund",
          "main",
          {
            type: "refund",
            provider: "vtpass",
            providerReference: providerResponse.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
            },
          }
        );

        await this.notificationService.createNotification({
          type: "transaction_failed",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "International Airtime",
            amount: data.amount,
            reference,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      return {
        result: TransactionMapper.toDTO(result),
        providerStatus: providerResponse.status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "International airtime purchase error - refund",
        "main",
        {
          type: "refund",
          provider: "vtpass",
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: { originalReference: reference, reason: "error" },
        }
      );
      throw error;
    }
  }

  // DATA METHODS
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

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "Data bundle purchase",
      "main",
      {
        type: "data",
        provider: service.name,
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        transactableType: "Product",
        transactableId: product.id,
        meta: {
          phone: data.phone,
          productName: product.name,
          serviceCode: service.code,
          serviceName: service.name,
          logo: service.logo || "",
        },
      }
    );

    const transaction = debitResult.transaction;

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
        provider: providerResponse.providerCode,
        providerReference: providerResponse.providerReference,
      });

      if (status === "pending" && providerResponse.providerReference) {
        await this.initializePolling(
          transaction.id,
          providerResponse.providerReference,
          providerResponse.providerCode
        );
      }

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "Data purchase failed - refund",
          "main",
          {
            type: "refund",
            provider: service.name,
            providerReference: providerResponse.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
            },
          }
        );
      }

      return {
        result: TransactionMapper.toDTO(result),
        providerStatus: providerResponse.status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "Data purchase error - refund",
        "main",
        {
          type: "refund",
          provider: service.name,
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: { originalReference: reference, reason: "error" },
        }
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

  // INTERNATIONAL DATA METHODS
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

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "International data purchase",
      "main",
      {
        type: "internationalData",
        provider: "vtpass",
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        meta: {
          phone: data.phone,
          productCode: data.productCode,
          operatorId: data.operatorId,
          countryCode: data.countryCode,
        },
      }
    );

    const transaction = debitResult.transaction;

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
        provider: providerResponse.providerCode,
        providerReference: providerResponse.providerReference,
      });

      if (status === "success") {
        await this.notificationService.createNotification({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "International Data",
            amount: totalAmount,
            reference,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "International data purchase failed - refund",
          "main",
          {
            type: "refund",
            provider: "vtpass",
            providerReference: providerResponse.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
            },
          }
        );

        await this.notificationService.createNotification({
          type: "transaction_failed",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "International Data",
            amount: totalAmount,
            reference,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      return {
        result: TransactionMapper.toDTO(result),
        providerStatus: providerResponse.status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "International data purchase error - refund",
        "main",
        {
          type: "refund",
          provider: "vtpass",
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: { originalReference: reference, reason: "error" },
        }
      );
      throw error;
    }
  }
  // CABLE TV METHODS
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

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      product.amount,
      "Cable TV subscription",
      "main",
      {
        type: "cable_tv",
        provider: service.name,
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        transactableType: "Product",
        transactableId: product.id,
        meta: {
          smartCardNumber: data.smartCardNumber,
          productName: product.name,
          serviceCode: service.code,
          serviceName: service.name,
          logo: service.logo || "",
          subscriptionType: data.type,
        },
      }
    );

    const transaction = debitResult.transaction;

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

      const result = await this.transactionRepository.update(transaction.id, {
        status,
        provider: providerResponse.providerCode,
        providerReference: providerResponse.providerReference,
      });

      if (status === "pending" && providerResponse.providerReference) {
        await this.initializePolling(
          transaction.id,
          providerResponse.providerReference,
          providerResponse.providerCode
        );
      }

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          product.amount,
          "Cable TV subscription failed - refund",
          "main",
          {
            type: "refund",
            provider: service.name,
            providerReference: providerResponse.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
            },
          }
        );
      }

      return {
        result: TransactionMapper.toDTO(result),
        providerStatus: providerResponse.status,
        status,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        product.amount,
        "Cable TV subscription error - refund",
        "main",
        {
          type: "refund",
          provider: service.name,
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: { originalReference: reference, reason: "error" },
        }
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

  // ELECTRICITY METHODS
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

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      data.amount,
      "Electricity bill payment",
      "main",
      {
        type: "electricity",
        provider: service.code,
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        transactableType: "Product",
        transactableId: service.id,
        meta: {
          meterNumber: data.meterNumber,
          meterType: data.meterType,
          serviceCode: service.code,
          serviceName: service.name,
          logo: service.logo || "",
        },
      }
    );

    const transaction = debitResult.transaction;

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

      const result = await this.transactionRepository.update(transaction.id, {
        provider: providerResponse.providerCode,
        providerReference: providerResponse.providerReference,
        status,
        meta: {
          ...transaction.meta,
          token: providerResponse.token,
        },
      });

      if (status === "pending" && providerResponse.providerReference) {
        await this.initializePolling(
          transaction.id,
          providerResponse.providerReference,
          providerResponse.providerCode
        );
      }
      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          "Electricity payment failed - refund",
          "main",
          {
            type: "refund",
            provider: service.code,
            providerReference: providerResponse.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
            },
          }
        );
      }

      return {
        result: TransactionMapper.toDTO(result),
        status,
        providerStatus: providerResponse.status,
        token: providerResponse.token,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        data.amount,
        "Electricity payment error - refund",
        "main",
        {
          type: "refund",
          provider: service.code,
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: { originalReference: reference, reason: "error" },
        }
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

  // BETTING METHODS
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

    const service = await this.serviceRepository.findById(providerId);

    if (!service) {
      throw new AppError(
        "Service not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    const serviceCode = service.code;

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      userId,
      amount,
      "Betting funding",
      "main",
      {
        type: "betting",
        provider: serviceCode,
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(userId),
        initiatedByType: "user",
        meta: { customerId, serviceCode },
      }
    );

    const transaction = debitResult.transaction;

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

      const result = await this.transactionRepository.update(transaction.id, {
        status,
        provider: providerResult.providerCode,
        providerReference: providerResult.providerReference,
      });

      if (status === "pending" && providerResult.providerReference) {
        await this.initializePolling(
          transaction.id,
          providerResult.providerReference,
          providerResult.providerCode
        );
      }

      if (status === "success") {
        await this.notificationService.createNotification({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(userId),
          data: {
            transactionType: "Betting",
            amount,
            reference,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          userId,
          amount,
          "Betting funding failed - refund",
          "main",
          {
            type: "refund",
            provider: serviceCode,
            providerReference: providerResult.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
            },
          }
        );
      }

      return {
        result: TransactionMapper.toDTO(result),
        providerStatus: providerResult.status,
        pending: status === "pending",
      };
    } catch (error: any) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        userId,
        amount,
        "Betting funding error - refund",
        "main",
        {
          type: "refund",
          provider: serviceCode,
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: { originalReference: reference, reason: "error" },
        }
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

  // E-PIN METHODS

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

    // Debit wallet atomically with transaction creation
    const debitResult = await this.walletService.debitWallet(
      data.userId,
      totalAmount,
      "E-Pin purchase",
      "main",
      {
        type: "e_pin",
        provider: service.name,
        idempotencyKey: reference,
        initiatedBy: new Types.ObjectId(data.userId),
        initiatedByType: "user",
        transactableType: "Product",
        transactableId: product.id,
        meta: {
          productName: product.name,
          serviceCode: service.code,
          serviceName: service.name,
          logo: service.logo || "",
          profileId: data.profileId,
          phone: data.user.phone,
        },
      }
    );

    const transaction = debitResult.transaction;

    try {
      const providerResponse = await this.providerService.purchaseEducation({
        profileId: data.profileId,
        variationCode: product.code,
        phone: data.user.phone!,
        amount: product.amount,
        reference,
        serviceCode: service.code,
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
        provider: providerResponse.providerCode,
        providerReference: providerResponse.providerReference,
      });

      if (status === "pending" && providerResponse.providerReference) {
        await this.initializePolling(
          transaction.id,
          providerResponse.providerReference,
          providerResponse.providerCode
        );
      }

      if (status === "success") {
        await this.notificationService.createNotification({
          type: "transaction_success",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "E-Pin",
            amount: totalAmount,
            reference,
            pin: providerResponse.token,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      // Refund for failed transactions only
      if (status === "failed") {
        await this.walletService.creditWallet(
          data.userId,
          totalAmount,
          "E-Pin purchase failed - refund",
          "main",
          {
            type: "refund",
            provider: service.name,
            providerReference: providerResponse.providerReference,
            idempotencyKey: `${reference}_refund`,
            initiatedByType: "system",
            meta: {
              originalReference: reference,
              reason: "transaction_failed",
            },
          }
        );

        await this.notificationService.createNotification({
          type: "transaction_failed",
          notifiableType: "User",
          notifiableId: new Types.ObjectId(data.userId),
          data: {
            transactionType: "E-Pin",
            amount: totalAmount,
            reference,
          },
          sendEmail: true,
          sendSMS: false,
          sendPush: true,
        });
      }

      return {
        result: TransactionMapper.toDTO(result),
        status,
        providerStatus: providerResponse.status,
        pin: providerResponse.token,
        pending: status === "pending",
      };
    } catch (error) {
      await this.transactionRepository.updateStatus(transaction.id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        totalAmount,
        "E-Pin purchase error - refund",
        "main",
        {
          type: "refund",
          provider: service.name,
          idempotencyKey: `${reference}_error_refund`,
          initiatedByType: "system",
          meta: { originalReference: reference, reason: "error" },
        }
      );
      throw error;
    }
  }

  async verifyEPinProfile(data: { number: string; type: string }) {
    return this.providerService.verifyJambProfile(data.number, data.type);
  }

  // GENERAL METHODS

  private getNetworkCode(network: string | undefined): string {
    if (!network) {
      throw new AppError(
        `Network is required`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    const networkMap: { [key: string]: string } = {
      "mtn-airtime": "mtn",
      "glo-airtime": "glo",
      "9mobile-airtime": "9mobile",
      "etisalat-airtime": "etisalat",
      "airtel-airtime": "airtel",

      "mtn-data": "mtn",
      "glo-data": "glo",
      "9mobile-data": "9mobile",
      "etisalat-data": "etisalat",
      "airtel-data": "airtel",
    };

    const code = networkMap[network.toLowerCase()];

    if (!code) {
      throw new AppError(
        `Unsupported network: ${network}`,
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    return code;
  }

  private async initializePolling(
    transactionId: string,
    providerReference: string,
    providerCode: string = "clubkonnect"
  ): Promise<void> {
    // Only initialize polling for providers that need it
    if (providerCode.toLowerCase() !== "clubkonnect") {
      logger.info(
        `Provider ${providerCode} uses webhooks, skipping polling initialization`
      );
      return;
    }

    try {
      await this.transactionRepository.update(transactionId, {
        polling: {
          nextPollAt: new Date(Date.now() + 10000),
          pollCount: 0,
          providerOrderId: providerReference,
        },
      });

      logger.info(`Polling initialized for transaction ${transactionId}`);
    } catch (error: any) {
      logger.error(
        `Error initializing polling for ${transactionId}`,
        error.message
      );
      // Don't throw - this shouldn't break the transaction
    }
  }
}
