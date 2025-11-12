import { Request, Response, NextFunction } from "express";
// import { verifyAdminAccessToken } from "@/config/admin-jwt";
import { Admin } from "@/models/admin/Admin";
import { sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";

export interface AuthenticatedAdminRequest extends Request {
  admin?: any;
}

export const adminAuth = async (
  req: AuthenticatedAdminRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return sendErrorResponse(
        res,
        "Admin authentication required",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    // const decoded = verifyAdminAccessToken(token);
    const admin = {
      status: "active",
      checkAccountLock: () => false,
      updateLastActive: () => {},
    };
    // await Admin.findById(decoded.id).select('-password -passwordHistory');

    if (!admin) {
      return sendErrorResponse(
        res,
        "Admin not found",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    if (admin.status !== "active") {
      return sendErrorResponse(
        res,
        `Admin account is ${admin.status}`,
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.UNAUTHORIZED
      );
    }

    if (admin.checkAccountLock()) {
      return sendErrorResponse(
        res,
        "Admin account is temporarily locked due to multiple failed login attempts",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.ACCOUNT_LOCKED
      );
    }

    // Update last active
    await admin.updateLastActive();

    req.admin = admin;
    next();
  } catch (error: any) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    ) {
      return sendErrorResponse(
        res,
        "Invalid or expired admin token",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }
    return sendErrorResponse(
      res,
      "Admin authentication failed",
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.UNAUTHORIZED
    );
  }
};
