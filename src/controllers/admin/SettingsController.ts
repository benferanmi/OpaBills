import { Request, Response } from "express";
import { SettingsService } from "@/services/admin/SettingsService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class SettingsController {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
  }

  getAllSettings = async (req: Request, res: Response) => {
    try {
      const result = await this.settingsService.getAllSettings();
      return sendSuccessResponse(
        res,
        result,
        "Settings retrieved successfully"
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getSettingByCode = async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const result = await this.settingsService.getSettingByCode(code);
      return sendSuccessResponse(
        res,
        result,
        "Setting retrieved"
      );
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateSetting = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { value } = req.body;
      const result = await this.settingsService.updateSetting(id, value);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
