import { WalletRepository } from '@/repositories/WalletRepository';
import { LedgerRepository } from '@/repositories/LedgerRepository';
import { NotificationRepository } from '@/repositories/NotificationRepository';
import { CacheService } from '../CacheService';
import { AppError } from '@/middlewares/errorHandler';
import { HTTP_STATUS, ERROR_CODES, CACHE_KEYS, WALLET_TYPES, LEDGER_TYPE } from '@/utils/constants';
import { Types } from 'mongoose';

export class WalletService {
      private walletRepository: WalletRepository
    private ledgerRepository: LedgerRepository
    private cacheService: CacheService
    private notificationRepository?: NotificationRepository
  constructor() {
    this.walletRepository = new WalletRepository();
    this.ledgerRepository = new LedgerRepository();
    this.cacheService = new CacheService();
    this.notificationRepository = new NotificationRepository();
  }

  async getWallet(userId: string, type: 'main' | 'bonus' | 'commission' = 'main'): Promise<any> {
    const wallet = await this.walletRepository.findByUserId(userId, type);
    if (!wallet) {
      throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    return {
      id: wallet._id,
      userId: wallet.userId,
      type: wallet.type,
      balance: wallet.balance,
      // createdAt: wallet.createdAt,
    };
  }

  async getAllWallets(userId: string): Promise<any> {
    const wallets = await this.walletRepository.findAllByUserId(userId);
    return wallets.map(wallet => ({
      id: wallet._id,
      type: wallet.type,
      balance: wallet.balance,
    }));
  }

  async creditWallet(
    userId: string | Types.ObjectId,
    amount: number,
    reason: string,
    walletType: 'main' | 'bonus' | 'commission' = 'main'
  ): Promise<any> {
    const wallet = await this.walletRepository.findByUserId(userId, walletType);
    if (!wallet) {
      throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const oldBalance = wallet.balance;
    const newBalance = oldBalance + amount;

    // Update wallet balance
    await this.walletRepository.updateBalance(wallet.id.toString(), newBalance);

    // Create ledger entry
    await this.ledgerRepository.create({
      ledgerableType: 'Wallet',
      ledgerableId: wallet._id as Types.ObjectId,
      source: 'system',
      destination: wallet.id.toString(),
      oldBalance,
      newBalance,
      type: LEDGER_TYPE.CREDIT,
      reason,
      amount,
      currencyCode: 'NGN',
    });

    // Invalidate cache
    await this.cacheService.delete(CACHE_KEYS.USER_WALLET(userId.toString()));

    // Send notification
    if (this.notificationRepository) {
      await this.notificationRepository.create({
        type: 'wallet_credit',
        notifiableType: 'User',
        notifiableId: userId as Types.ObjectId,
        data: {
          amount,
          balance: newBalance,
          reason,
        },
      });
    }

    return {
      walletId: wallet._id,
      oldBalance,
      newBalance,
      amount,
      type: LEDGER_TYPE.CREDIT,
    };
  }

  async debitWallet(
    userId: string | Types.ObjectId,
    amount: number,
    reason: string,
    walletType: 'main' | 'bonus' | 'commission' = 'main'
  ): Promise<any> {
    const wallet = await this.walletRepository.findByUserId(userId, walletType);
    if (!wallet) {
      throw new AppError('Wallet not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    const oldBalance = wallet.balance;
    if (oldBalance < amount) {
      throw new AppError('Insufficient balance', HTTP_STATUS.BAD_REQUEST, ERROR_CODES.INSUFFICIENT_BALANCE);
    }

    const newBalance = oldBalance - amount;

    // Update wallet balance
    await this.walletRepository.updateBalance(wallet.id.toString(), newBalance);

    // Create ledger entry
    await this.ledgerRepository.create({
      ledgerableType: 'Wallet',
      ledgerableId: wallet._id as Types.ObjectId,
      source: wallet.id.toString(),
      destination: 'system',
      oldBalance,
      newBalance,
      type: LEDGER_TYPE.DEBIT,
      reason,
      amount,
      currencyCode: 'NGN',
    });

    // Invalidate cache
    await this.cacheService.delete(CACHE_KEYS.USER_WALLET(userId.toString()));

    // Send notification
    if (this.notificationRepository) {
      await this.notificationRepository.create({
        type: 'wallet_debit',
        notifiableType: 'User',
        notifiableId: userId as Types.ObjectId,
        data: {
          amount,
          balance: newBalance,
          reason,
        },
      });
    }

    return {
      walletId: wallet._id,
      oldBalance,
      newBalance,
      amount,
      type: LEDGER_TYPE.DEBIT,
    };
  }
}
