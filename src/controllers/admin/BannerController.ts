import { Request, Response } from "express";
import { BannerService } from "@/services/admin/BannerService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class BannerController {
  private bannerService: BannerService;

  constructor() {
    this.bannerService = new BannerService();
  }

  listBanners = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.bannerService.listBanners(
        Number(page),
        Number(limit)
      );
      return sendSuccessResponse(res, result, "Banners retrieved successfully");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  createBanner = async (req: Request, res: Response) => {
    try {
      const result = await this.bannerService.createBanner(req.body);
      return sendSuccessResponse(
        res,
        result,

        result.message,
        HTTP_STATUS.CREATED
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getBannerDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.bannerService.getBannerDetails(id);
      return sendSuccessResponse(res, result, "Banner details retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateBanner = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.bannerService.updateBanner(id, req.body);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  deleteBanner = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.bannerService.deleteBanner(id);
      return sendSuccessResponse(res, null, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
