import { BaseRepository } from "./BaseRepository";
import { Types } from "mongoose";
import { Bank, IBank } from "@/models/reference/Bank";
export class BankAccountRepository extends BaseRepository<IBank> {
  constructor() {
    super(Bank);
  }

  async findByFlutterWaveCode(code: string): Promise<IBank[]> {
    return this.model.find({ flutterwaveCode: code });
  }

  async findBymonnifyCode(code: string): Promise<IBank[]> {
    return this.model.find({ monnifyCode: code });
  }

  async findBySavehavenCode(code: string): Promise<IBank[]> {
    return this.model.find({ savehavenCode: code });
  }
}
