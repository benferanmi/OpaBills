import { Request, Response } from "express";
import { AdminManagementService } from "@/services/admin/AdminManagementService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";
import { AuthenticatedAdminRequest } from "@/middlewares/admin/adminAuth";

export class AdminController {
  private adminService: AdminManagementService;

  constructor() {
    this.adminService = new AdminManagementService();
  }

  listAdmins = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20, ...filters } = req.query;
      const result = await this.adminService.listAdmins(
        Number(page),
        Number(limit),
        filters
      );
      return sendSuccessResponse(res, "Admins result, retrieved successfully");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  createAdmin = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const result = await this.adminService.createAdmin(req.body);
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

  getAdminDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.adminService.getAdminDetails(id);
      return sendSuccessResponse(res, "Admin result, details retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateAdmin = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.adminService.updateAdmin(id, req.body);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  assignRole = async (req: AuthenticatedAdminRequest, res: Response) => {
    try {
      const { id, roleId } = req.params;
      const result = {
        message: "true",
      };
      // await this.adminService.assignRole(
      //   id,
      //   roleId,
      //   req.admin._id.toString()
      // );
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  updateAdminStatus = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const result = await this.adminService.updateAdminStatus(id, status);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  deleteAdmin = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.adminService.deleteAdmin(id);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  resetAdminPassword = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.adminService.resetAdminPassword(id);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
