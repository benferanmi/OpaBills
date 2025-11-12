import { DiscountRepository } from "@/repositories/DiscountRepository";

export class DiscountService {
  private discountRepository: DiscountRepository;

  constructor() {
    this.discountRepository = new DiscountRepository();
  }

  async listDiscounts(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = {};

    if (filters.serviceId) {
      query.serviceId = filters.serviceId;
    }

    if (filters.status !== undefined) {
      query.active = filters.status === "active";
    }

    if (filters.code) {
      query.code = { $regex: filters.code, $options: "i" };
    }

    const result = await this.discountRepository.findWithPagination(
      query,
      page,
      limit
    );

    return {
      discounts: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createDiscount(data: any) {
    const existingDiscount = await this.discountRepository.findByCode(
      data.code
    );
    if (existingDiscount) {
      throw new Error("Discount code already exists");
    }

    const discount = await this.discountRepository.create(data);
    return { message: "Discount created successfully", discount };
  }

  async getDiscountDetails(discountId: string) {
    const discount = await this.discountRepository.findById(discountId);
    if (!discount) {
      throw new Error("Discount not found");
    }
    return discount;
  }

  async updateDiscount(discountId: string, data: any) {
    const discount = await this.discountRepository.findById(discountId);
    if (!discount) {
      throw new Error("Discount not found");
    }

    if (data.code && data.code !== discount.code) {
      const existingDiscount = await this.discountRepository.findByCode(
        data.code
      );
      if (existingDiscount) {
        throw new Error("Discount code already exists");
      }
    }

    const updatedDiscount = await this.discountRepository.update(
      discountId,
      data
    );
    return {
      message: "Discount updated successfully",
      discount: updatedDiscount,
    };
  }

  async deleteDiscount(discountId: string) {
    const discount = await this.discountRepository.findById(discountId);
    if (!discount) {
      throw new Error("Discount not found");
    }

    await this.discountRepository.delete(discountId);
    return { message: "Discount deleted successfully" };
  }

  async toggleDiscountStatus(discountId: string) {
    const discount = await this.discountRepository.toggleActiveStatus(
      discountId
    );
    if (!discount) {
      throw new Error("Discount not found");
    }
    return { message: "Discount status updated successfully", discount };
  }

  async getDiscountByCode(code: string) {
    const discount = await this.discountRepository.findByCode(code);
    if (!discount) {
      throw new Error("Discount not found");
    }
    if (!discount.active) {
      throw new Error("Discount is not active");
    }
    return discount;
  }
}
