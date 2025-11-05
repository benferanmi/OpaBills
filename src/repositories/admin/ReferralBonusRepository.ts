// import { BaseRepository } from '../BaseRepository';
// import { ReferralBonus, IReferralBonus } from '@/models/admin/ReferralBonus';

// export class ReferralBonusRepository extends BaseRepository<IReferralBonus> {
//   constructor() {
//     super(ReferralBonus);
//   }

//   async findActive(): Promise<IReferralBonus | null> {
//     return await this.model.findOne({ status: 'active' }).exec();
//   }
// }
