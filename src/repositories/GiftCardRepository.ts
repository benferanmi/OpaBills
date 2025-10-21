import { BaseRepository } from './BaseRepository';
import { GiftCard, IGiftCard } from '@/models/giftcard/GiftCard';
import { GiftCardCategory, IGiftCardCategory } from '@/models/giftcard/GiftCardCategory';
import { GiftCardTransaction, IGiftCardTransaction } from '@/models/giftcard/GiftCardTransaction';
import { Types } from 'mongoose';

export class GiftCardRepository extends BaseRepository<IGiftCard> {
  constructor() {
    super(GiftCard);
  }

  async findByProductId(productId: string): Promise<IGiftCard | null> {
    return this.model.findOne({ productId, status: 'active' }).exec();
  }

  async findByCategory(categoryId: string | Types.ObjectId, page: number = 1, limit: number = 10) {
    return this.findWithPagination({ categoryId, status: 'active' }, page, limit);
  }

  async findByCountry(countryId: string | Types.ObjectId, page: number = 1, limit: number = 10) {
    return this.findWithPagination({ countryId, status: 'active' }, page, limit);
  }

  async searchGiftCards(query: string, page: number = 1, limit: number = 10) {
    const searchRegex = new RegExp(query, 'i');
    return this.findWithPagination(
      { name: searchRegex, status: 'active' },
      page,
      limit
    );
  }
}

export class GiftCardCategoryRepository extends BaseRepository<IGiftCardCategory> {
  constructor() {
    super(GiftCardCategory);
  }

  async findActive(page: number = 1, limit: number = 10) {
    return this.findWithPagination({ status: 'active' }, page, limit);
  }

  async findByCategoryId(categoryId: string): Promise<IGiftCardCategory | null> {
    return this.model.findOne({ categoryId, status: 'active' }).exec();
  }
}

export class GiftCardTransactionRepository extends BaseRepository<IGiftCardTransaction> {
  constructor() {
    super(GiftCardTransaction);
  }

  async findByReference(reference: string): Promise<IGiftCardTransaction | null> {
    return this.model.findOne({ reference }).exec();
  }

  async findByUserId(
    userId: string | Types.ObjectId,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    return this.findWithPagination({ userId, ...filters }, page, limit);
  }

  async findByGroupTag(groupTag: string): Promise<IGiftCardTransaction[]> {
    return this.model.find({ groupTag }).exec();
  }

  async updateStatus(
    transactionId: string,
    status: 'pending' | 'success' | 'failed' | 'approved' | 'declined',
    reviewData?: any
  ): Promise<IGiftCardTransaction | null> {
    return this.model.findByIdAndUpdate(
      transactionId,
      { status, ...reviewData },
      { new: true }
    ).exec();
  }
}
