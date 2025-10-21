import { BaseRepository } from './BaseRepository';
import { City, ICity } from '@/models/reference/City';
import { Types } from 'mongoose';

export class CityRepository extends BaseRepository<ICity> {
  constructor() {
    super(City);
  }

  async findByStateId(stateId: string | Types.ObjectId): Promise<ICity[]> {
    return this.model.find({ stateId }).exec();
  }

  async searchByName(stateId: string | Types.ObjectId, name: string): Promise<ICity[]> {
    return this.model.find({ stateId, name: new RegExp(name, 'i') }).exec();
  }
}
