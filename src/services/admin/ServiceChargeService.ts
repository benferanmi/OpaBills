import { ServiceRepository } from '@/repositories/ServiceRepository';

export class ServiceChargeService {
  private serviceRepository: ServiceRepository;

  constructor() {
    this.serviceRepository = new ServiceRepository();
  }

  async listServiceCharges(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = {};

    if (filters.serviceId) {
      query.serviceId = filters.serviceId;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    const result = await this.serviceRepository.findWithPagination(query, page, limit);

    return {
      serviceCharges: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createServiceCharge(data: any) {
    const serviceCharge = await this.serviceRepository.create(data);
    return { message: 'Service charge created successfully', serviceCharge };
  }

  async getServiceChargeDetails(chargeId: string) {
    const serviceCharge = await this.serviceRepository.findById(chargeId);
    if (!serviceCharge) {
      throw new Error('Service charge not found');
    }
    return serviceCharge;
  }

  async updateServiceCharge(chargeId: string, data: any) {
    const serviceCharge = await this.serviceRepository.findById(chargeId);
    if (!serviceCharge) {
      throw new Error('Service charge not found');
    }

    Object.assign(serviceCharge, data);
    await serviceCharge.save();

    return { message: 'Service charge updated successfully', serviceCharge };
  }

  async deleteServiceCharge(chargeId: string) {
    await this.serviceRepository.delete(chargeId);
    return { message: 'Service charge deleted successfully' };
  }
}
