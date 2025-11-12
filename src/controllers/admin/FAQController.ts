import { Request, Response } from "express";
import { FAQManagementService } from "@/services/admin/FAQManagementService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class FAQController {
  private faqService: FAQManagementService;

  constructor() {
    this.faqService = new FAQManagementService();
  }

  listFAQs = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.faqService.listFAQs(
        Number(page),
        Number(limit),
        filters
      );
      return sendSuccessResponse(res, "result, FAQs retrieved successfully");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  createFAQ = async (req: Request, res: Response) => {
    try {
      const result = await this.faqService.createFAQ(req.body);
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

  getFAQDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.faqService.getFAQDetails(id);
      return sendSuccessResponse(res, "result, FAQ details retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateFAQ = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.faqService.updateFAQ(id, req.body);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  deleteFAQ = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.faqService.deleteFAQ(id);
      return sendSuccessResponse(res, null, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  listCategories = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.faqService.listCategories(
        Number(page),
        Number(limit)
      );
      return sendSuccessResponse(res, "result, FAQ categories retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  createCategory = async (req: Request, res: Response) => {
    try {
      const result = await this.faqService.createCategory(req.body);
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

  updateCategory = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.faqService.updateCategory(id, req.body);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  deleteCategory = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.faqService.deleteCategory(id);
      return sendSuccessResponse(res, null, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
