import { Request, Response } from "express";
import { RoleService } from "@/services/admin/RoleService";
import { sendSuccessResponse, sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS } from "@/utils/constants";

export class RoleController {
  private roleService: RoleService;

  constructor() {
    this.roleService = new RoleService();
  }

  listRoles = async (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await this.roleService.listRoles(
        Number(page),
        Number(limit)
      );
      return sendSuccessResponse(res, result, "Roles retrieved successfully");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  createRole = async (req: Request, res: Response) => {
    try {
      const result = await this.roleService.createRole(req.body);
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

  getRoleDetails = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.roleService.getRoleDetails(id);
      return sendSuccessResponse(res, result, "Role details retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.NOT_FOUND);
    }
  };

  updateRole = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.roleService.updateRole(id, req.body);
      return sendSuccessResponse(res, result, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  deleteRole = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const result = await this.roleService.deleteRole(id);
      return sendSuccessResponse(res, null, result.message);
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };

  getAllPermissions = async (req: Request, res: Response) => {
    try {
      const result = await this.roleService.getAllPermissions();
      return sendSuccessResponse(res, result, "Permissions retrieved");
    } catch (error: any) {
      return sendErrorResponse(res, error.message, HTTP_STATUS.BAD_REQUEST);
    }
  };
}
