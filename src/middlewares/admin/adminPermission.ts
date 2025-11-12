import { Response, NextFunction } from "express";
import { AuthenticatedAdminRequest } from "./adminAuth";
import { sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";

export const requirePermission = (...permissions: string[]) => {
  return (
    req: AuthenticatedAdminRequest,
    res: Response,
    next: NextFunction
  ) => {
    if (!req.admin) {
      return sendErrorResponse(
        res,
        "Admin authentication required",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    // Super admin has all permissions
    if (req.admin.permissions.includes("*")) {
      return next();
    }

    // Check if admin has at least one of the required permissions
    const hasPermission = permissions.some((permission) =>
      req.admin.permissions.includes(permission)
    );

    if (!hasPermission) {
      return sendErrorResponse(
        res,
        "Insufficient permissions",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    next();
  };
};
