import { Request, Response } from "express";
import { AlertService } from "@/services/admin/AlertService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class AlertController {
  private alertService: AlertService;

  constructor() {
    this.alertService = new AlertService();
  }

  listAlerts = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.alertService.listAlerts(
        Number(page),
        Number(limit),
        filters
      );
      return sendSuccessResponse(res, "result,Alerts retrieved successfully");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  createAlert = async (req: Request, res: Response) => {
    try {
      const result = await this.alertService.createAlert(req.body);
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

  getAlertDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.alertService.getAlertDetails(id);
      return sendSuccessResponse(res, "result,Alert details retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateAlert = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.alertService.updateAlert(id, req.body);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  deleteAlert = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.alertService.deleteAlert(id);
      return sendSuccessResponse(res, null, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  restoreAlert = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.alertService.restoreAlert(id);
      return sendSuccessResponse(res, null, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  dispatchAlert = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.alertService.dispatchAlert(id);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
