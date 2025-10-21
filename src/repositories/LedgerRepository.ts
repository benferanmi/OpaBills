import { BaseRepository } from './BaseRepository';
import { Ledger, ILedger } from '@/models/wallet/Ledger';
import { Types } from 'mongoose';

export class LedgerRepository extends BaseRepository<ILedger> {
  constructor() {
    super(Ledger);
  }

  async findByLedgerableId(ledgerableId: string | Types.ObjectId, page: number = 1, limit: number = 10) {
    return this.findWithPagination({ ledgerableId }, page, limit);
  }

  async findByType(ledgerableId: string | Types.ObjectId, type: 'debit' | 'credit', page: number = 1, limit: number = 10) {
    return this.findWithPagination({ ledgerableId, type }, page, limit);
  }
}
