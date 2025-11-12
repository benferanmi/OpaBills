import { BaseRepository } from "../BaseRepository";
import { Settings, ISettings } from "@/models/system/Settings";

export class SettingsRepository extends BaseRepository<ISettings> {
  constructor() {
    super(Settings);
  }

  async findAll(): Promise<ISettings[]> {
    return this.model.find({}).sort({ name: 1 }).exec();
  }

  async findByCode(code: string): Promise<ISettings | null> {
    return await this.model.findOne({ code }).exec();
  }

  async updateByCode(code: string, value: string): Promise<ISettings | null> {
    return await this.model
      .findOneAndUpdate({ code }, { value }, { new: true })
      .exec();
  }
}
