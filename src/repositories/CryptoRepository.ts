import { BaseRepository } from './BaseRepository';
import { Crypto, ICrypto } from '@/models/crypto/Crypto';
import { CryptoTransaction, ICryptoTransaction } from '@/models/crypto/CryptoTransaction';

export class CryptoRepository extends BaseRepository<ICrypto> {
  constructor() {
    super(Crypto);
  }

  async findByAssetId(assetId: string): Promise<ICrypto | null> {
    return this.model.findOne({ assetId }).exec();
  }

  async findByCode(code: string): Promise<ICrypto | null> {
    return this.model.findOne({ code }).exec();
  }

  async findActive(filters: any = {}, page: number = 1, limit: number = 10) {
    const query: any = { deletedAt: null };
    
    if (filters.saleActivated !== undefined) {
      query.saleActivated = filters.saleActivated;
    }
    
    if (filters.purchaseActivated !== undefined) {
      query.purchaseActivated = filters.purchaseActivated;
    }
    
    return this.findWithPagination(query, page, limit);
  }

  async searchCryptos(search: string, page: number = 1, limit: number = 10) {
    const query = {
      deletedAt: null,
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ],
    };
    
    return this.findWithPagination(query, page, limit);
  }
}

export class CryptoTransactionRepository extends BaseRepository<ICryptoTransaction> {
  constructor() {
    super(CryptoTransaction);
  }

  async findByReference(reference: string): Promise<ICryptoTransaction | null> {
    return this.model.findOne({ reference }).exec();
  }

  async findByUserId(userId: string, filters: any = {}, page: number = 1, limit: number = 10) {
    const query: any = { userId, ...filters };
    return this.findWithPagination(query, page, limit, { createdAt: -1 });
  }

  async updateStatus(transactionId: string, status: string): Promise<ICryptoTransaction | null> {
    return this.model.findByIdAndUpdate(
      transactionId,
      { status },
      { new: true }
    ).exec();
  }
}
