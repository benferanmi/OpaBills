import { BannerRepository } from '@/repositories/admin/BannerRepository';

export class BannerService {
  private bannerRepository: BannerRepository;

  constructor() {
    this.bannerRepository = new BannerRepository();
  }

  async listBanners(page: number = 1, limit: number = 20) {
    const result = await this.bannerRepository.findWithPagination({}, page, limit);

    return {
      banners: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async createBanner(data: any) {
    const banner = await this.bannerRepository.create(data);
    return { message: 'Banner created successfully', banner };
  }

  async getBannerDetails(bannerId: string) {
    const banner = await this.bannerRepository.findById(bannerId);
    if (!banner) {
      throw new Error('Banner not found');
    }
    return banner;
  }

  async updateBanner(bannerId: string, data: any) {
    const banner = await this.bannerRepository.findById(bannerId);
    if (!banner) {
      throw new Error('Banner not found');
    }

    Object.assign(banner, data);
    await banner.save();

    return { message: 'Banner updated successfully', banner };
  }

  async deleteBanner(bannerId: string) {
    await this.bannerRepository.delete(bannerId);
    return { message: 'Banner deleted successfully' };
  }
}
