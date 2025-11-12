import { ProductRepository } from "@/repositories/ProductRepository";

export class ProductManagementService {
  private productRepository: ProductRepository;

  constructor() {
    this.productRepository = new ProductRepository();
  }

  async listProducts(page: number = 1, limit: number = 20, filters: any = {}) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.serviceId) {
      query.serviceId = filters.serviceId;
    }

    if (filters.search) {
      query.name = { $regex: filters.search, $options: "i" };
    }

    const result = await this.productRepository.findWithPagination(
      query,
      page,
      limit
    );

    return {
      products: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createProduct(data: any) {
    const product = await this.productRepository.create(data);
    return { message: "Product created successfully", product };
  }

  async getProductDetails(productId: string) {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }
    return product;
  }

  async updateProduct(productId: string, data: any) {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    Object.assign(product, data);
    await product.save();

    return { message: "Product updated successfully", product };
  }

  async updateProductStatus(productId: string, status: boolean) {
    const product = await this.productRepository.findById(productId);
    if (!product) {
      throw new Error("Product not found");
    }

    product.isActive = status;
    await product.save();

    return {
      message: "Product status updated successfully",
      status: product.isActive,
    };
  }

  async deleteProduct(productId: string) {
    await this.productRepository.delete(productId);
    return { message: "Product deleted successfully" };
  }
}
