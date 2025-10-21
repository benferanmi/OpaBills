import { BaseRepository } from './BaseRepository';
import { Country, ICountry } from '@/models/reference/Country';

export class CountryRepository extends BaseRepository<ICountry> {
  constructor() {
    super(Country);
  }

  async findByIso2(iso2: string): Promise<ICountry | null> {
    return this.model.findOne({ iso2: iso2.toUpperCase() }).exec();
  }

  async findByIso3(iso3: string): Promise<ICountry | null> {
    return this.model.findOne({ iso3: iso3.toUpperCase() }).exec();
  }

  async searchByName(name: string): Promise<ICountry[]> {
    return this.model.find({ name: new RegExp(name, 'i') }).exec();
  }
}
