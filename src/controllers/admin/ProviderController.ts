import { Request, Response } from "express";
import { ProviderManagementService } from "@/services/admin/ProviderManagementService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class ProviderController {
  private providerService: ProviderManagementService;

  constructor() {
    this.providerService = new ProviderManagementService();
  }

  listProviders = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.providerService.listProviders(
        Number(page),
        Number(limit),
        filters
      );
      return sendSuccessResponse(
        res,
        "Providers result, retrieved successfully"
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  createProvider = async (req: Request, res: Response) => {
    try {
      const result = await this.providerService.createProvider(req.body);
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

  getProviderDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.providerService.getProviderDetails(id);
      return sendSuccessResponse(res, "Provider result, details retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateProvider = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.providerService.updateProvider(id, req.body);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  updateProviderStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await this.providerService.updateProviderStatus(
        id,
        status
      );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  deleteProvider = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.providerService.deleteProvider(id);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getProviderProducts = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;
      const result = await this.providerService.getProviderProducts(
        id,
        Number(page),
        Number(limit)
      );
      return sendSuccessResponse(res, result, "Provider products retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
