import { TransactionRepository } from '@/repositories/TransactionRepository';
import { NotificationRepository } from '@/repositories/NotificationRepository';
import { WalletService } from './WalletService';
import { ProductRepository } from '@/repositories/ProductRepository';
import { ProviderService } from './ProviderService';
import { AppError } from '@/utils/helpers';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';
import { generateReference } from '@/utils/formatters';
import { Types } from 'mongoose';

interface BillPaymentData {
  userId: string;
  productId: string;
  amount: number;
  phone?: string;
  phoneCode?: string;
  smartCardNumber?: string;
  meterNumber?: string;
  meterType?: string;
}

export class BillPaymentService {
  constructor(
    private transactionRepository: TransactionRepository,
    private walletService: WalletService,
    private productRepository: ProductRepository,
    private providerService: ProviderService,
    private notificationRepository?: NotificationRepository
  ) {}

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
      throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Check balance
    if (wallet.balance < data.amount) {
      throw new AppError('Insufficient wallet balance', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INSUFFICIENT_BALANCE);
    }

    // Deduct from wallet
    await this.walletService.debitWallet(data.userId, data.amount, 'Airtime purchase', 'main');

    // Create transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      reference,
      amount: data.amount,
      type: 'airtime',
      provider: data.providerId,
      remark: `Airtime purchase for ${data.phone}`,
      purpose: 'airtime_purchase',
      status: 'pending',
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
      const status = providerResponse.success ? 'success' : 'failed';
      await this.transactionRepository.updateStatus(transaction._id, status);

      // Send notification
      if (this.notificationRepository) {
        await this.notificationRepository.create({
          type: status === 'success' ? 'transaction_success' : 'transaction_failed',
          notifiableType: 'User',
          notifiableId: data.userId,
          data: {
            transactionType: 'Airtime',
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
          'Airtime purchase failed - refund',
          'main'
        );
      }

      return {
        ...transaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.transactionRepository.updateStatus(transaction._id, 'failed');
      await this.walletService.creditWallet(data.userId, data.amount, 'Airtime purchase error - refund', 'main');
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
      throw new AppError('Product not found or inactive', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Get user wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Check balance
    const totalAmount = data.amount;
    if (wallet.balance < totalAmount) {
      throw new AppError('Insufficient wallet balance', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INSUFFICIENT_BALANCE);
    }

    // Deduct from wallet
    await this.walletService.debitWallet(data.userId, totalAmount, 'Data bundle purchase', 'main');

    // Create transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: 'Product',
      transactableId: product._id,
      reference,
      amount: totalAmount,
      type: 'data',
      provider: product.providerId.toString(),
      remark: `Data purchase: ${product.name} for ${data.phone}`,
      purpose: 'data_purchase',
      status: 'pending',
      meta: { phone: data.phone, phoneCode: data.phoneCode, productName: product.name },
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
      const status = providerResponse.success ? 'success' : 'failed';
      await this.transactionRepository.updateStatus(transaction._id, status);

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(data.userId, totalAmount, 'Data purchase failed - refund', 'main');
      }

      return {
        ...transaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.transactionRepository.updateStatus(transaction._id, 'failed');
      await this.walletService.creditWallet(data.userId, totalAmount, 'Data purchase error - refund', 'main');
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
      throw new AppError('Product not found or inactive', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Get user wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Check balance
    if (wallet.balance < data.amount) {
      throw new AppError('Insufficient wallet balance', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INSUFFICIENT_BALANCE);
    }

    // Deduct from wallet
    await this.walletService.debitWallet(data.userId, data.amount, 'Cable TV subscription', 'main');

    // Create transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: 'Product',
      transactableId: product._id,
      reference,
      amount: data.amount,
      type: 'cable_tv',
      provider: product.providerId.toString(),
      remark: `Cable TV: ${product.name} for ${data.smartCardNumber}`,
      purpose: 'cable_tv_subscription',
      status: 'pending',
      meta: { smartCardNumber: data.smartCardNumber, productName: product.name },
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
      const status = providerResponse.success ? 'success' : 'failed';
      await this.transactionRepository.updateStatus(transaction._id, status);

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          'Cable TV subscription failed - refund',
          'main'
        );
      }

      return {
        ...transaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.transactionRepository.updateStatus(transaction._id, 'failed');
      await this.walletService.creditWallet(data.userId, data.amount, 'Cable TV subscription error - refund', 'main');
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
      throw new AppError('Product not found or inactive', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Get user wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.RESOURCE_NOT_FOUND);
    }

    // Check balance
    if (wallet.balance < data.amount) {
      throw new AppError('Insufficient wallet balance', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INSUFFICIENT_BALANCE);
    }

    // Deduct from wallet
    await this.walletService.debitWallet(data.userId, data.amount, 'Electricity bill payment', 'main');

    // Create transaction record
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: 'Product',
      transactableId: product._id,
      reference,
      amount: data.amount,
      type: 'electricity',
      provider: product.providerId.toString(),
      remark: `Electricity: ${product.name} for ${data.meterNumber}`,
      purpose: 'electricity_payment',
      status: 'pending',
      meta: { meterNumber: data.meterNumber, meterType: data.meterType, productName: product.name },
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
      const status = providerResponse.success ? 'success' : 'failed';
      await this.transactionRepository.updateStatus(transaction._id, status);

      // If failed, reverse wallet deduction
      if (!providerResponse.success) {
        await this.walletService.creditWallet(
          data.userId,
          data.amount,
          'Electricity payment failed - refund',
          'main'
        );
      }

      return {
        ...transaction.toObject(),
        status,
        providerResponse,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.transactionRepository.updateStatus(transaction._id, 'failed');
      await this.walletService.creditWallet(data.userId, data.amount, 'Electricity payment error - refund', 'main');
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
      type: { $in: ['airtime', 'data', 'cable_tv', 'electricity'] },
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
