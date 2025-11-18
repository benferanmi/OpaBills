import {
  Model,
  Document,
  FilterQuery,
  UpdateQuery,
  QueryOptions,
  PipelineStage,
} from "mongoose";

export abstract class BaseRepository<T extends Document> {
  constructor(protected model: Model<T>) {}

  async create(data: Partial<T>): Promise<T> {
    const document = new this.model(data);
    return await document.save();
  }

  async findById(id: string): Promise<T | null> {
    return await this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return await this.model.findOne(filter).exec();
  }

  async find(filter: FilterQuery<T> = {}): Promise<T[]> {
    return await this.model.find(filter).exec();
  }

async findWithPagination(
  filter: FilterQuery<T>,
  page: number = 1,
  limit: number = 10,
  sort: any = { createdAt: -1 },
  populate?: Array<{ path: string; select?: string }>
): Promise<{ data: T[]; total: number }> {
  const skip = (page - 1) * limit;
  
  let query = this.model.find(filter).sort(sort).skip(skip).limit(limit);
  
  // Apply populate if provided
  if (populate && populate.length > 0) {
    populate.forEach(pop => {
      query = query.populate(pop);
    });
  }
  
  const [data, total] = await Promise.all([
    query.exec(),
    this.model.countDocuments(filter).exec(),
  ]);
  
  return { data, total };
}

  async update(id: string, data: UpdateQuery<T>): Promise<T | null> {
    return await this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async updateOne(
    filter: FilterQuery<T>,
    data: UpdateQuery<T>
  ): Promise<T | null> {
    return await this.model
      .findOneAndUpdate(filter, data, { new: true })
      .exec();
  }

  async delete(id: string): Promise<T | null> {
    return await this.model.findByIdAndDelete(id).exec();
  }

  async softDelete(id: string): Promise<T | null> {
    return await this.model
      .findByIdAndUpdate(id, { deletedAt: new Date() }, { new: true })
      .exec();
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return await this.model.countDocuments(filter).exec();
  }
  async aggregate<T = any>(pipeline: PipelineStage[]): Promise<T[]> {
    return this.model.aggregate<T>(pipeline).exec();
  }
}
