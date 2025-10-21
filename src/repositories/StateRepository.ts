import { BaseRepository } from './BaseRepository';
import { State, IState } from '@/models/reference/State';
import { Types } from 'mongoose';

export class StateRepository extends BaseRepository<IState> {
  constructor() {
    super(State);
  }

  async findByCountryId(countryId: string | Types.ObjectId): Promise<IState[]> {
    return this.model.find({ countryId }).exec();
  }

  async searchByName(countryId: string | Types.ObjectId, name: string): Promise<IState[]> {
    return this.model.find({ countryId, name: new RegExp(name, 'i') }).exec();
  }
}
