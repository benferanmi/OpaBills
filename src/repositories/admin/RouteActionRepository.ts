import { BaseRepository } from '../BaseRepository';
import { RouteAction, IRouteAction } from '@/models/system/RouteAction';

export class RouteActionRepository extends BaseRepository<IRouteAction> {
  constructor() {
    super(RouteAction);
  }

  async findBySlug(slug: string): Promise<IRouteAction | null> {
    return await this.model.findOne({ slug }).exec();
  }

  async findActiveActions(): Promise<IRouteAction[]> {
    return await this.model.find({ status: 'active' }).exec();
  }
}
