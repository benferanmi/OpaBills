import { ServiceTypeRepository } from "@/repositories/ServiceTypeRepository";

export class ServiceTypeService {
  private serviceTypeRepository: ServiceTypeRepository;

  constructor() {
    this.serviceTypeRepository = new ServiceTypeRepository();
  }

  async listServiceTypes(page: number, limit: number, filters: any) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.search) {
      query.$or = [
        { name: { $regex: filters.search, $options: "i" } },
        { code: { $regex: filters.search, $options: "i" } },
      ];
    }

    const serviceTypes = await this.serviceTypeRepository.findMany(
      query,
      page,
      limit
    );

    return serviceTypes;
  }

  async createServiceType(data: any) {
    const existing = await this.serviceTypeRepository.findOne({
      code: data.code,
    });
    if (existing) {
      throw new Error("Service type with this code already exists");
    }

    const serviceType = await this.serviceTypeRepository.create(data);
    return {
      message: "Service type created successfully",
      serviceType,
    };
  }

  async getServiceTypeDetails(id: string) {
    const serviceType = await this.serviceTypeRepository.findById(id);
    if (!serviceType) {
      throw new Error("Service type not found");
    }
    return serviceType;
  }

  async updateServiceType(id: string, data: any) {
    if (data.code) {
      const existing = await this.serviceTypeRepository.findOne({
        code: data.code,
        _id: { $ne: id },
      });
      if (existing) {
        throw new Error("Service type with this code already exists");
      }
    }

    const serviceType = await this.serviceTypeRepository.update(id, data);
    if (!serviceType) {
      throw new Error("Service type not found");
    }

    return {
      message: "Service type updated successfully",
      serviceType,
    };
  }

  async deleteServiceType(id: string) {
    const serviceType = await this.serviceTypeRepository.delete(id);
    if (!serviceType) {
      throw new Error("Service type not found");
    }

    return {
      message: "Service type deleted successfully",
    };
  }
}
