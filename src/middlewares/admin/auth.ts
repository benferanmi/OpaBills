import { Response, NextFunction } from "express";
import { AdminAuthenticatedRequest } from "@/types/admin";
import { sendErrorResponse } from "@/utils/helpers";
import { ERROR_CODES, HTTP_STATUS } from "@/utils/constants";
import logger from "@/logger";
import { CacheService } from "@/services/CacheService";
import Admin from "@/models/admin/Index";
import adminJwtUtil from "@/config/admin/jwt";

const cacheService = new CacheService();
export const verifyAdminToken = async (
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = (req.headers as any).authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendErrorResponse(
        res,
        "Authorization token required",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.TOKEN_REQUIRED
      );
    }

    const token = authHeader.substring(7);

    // Verify and decode the token
    const decoded = await adminJwtUtil.verifyAccessToken(token);
    if (!decoded) {
      return sendErrorResponse(
        res,
        "Invalid or expired token",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    // Check if token is blacklisted
    // const isBlacklisted = await cacheService.isTokenBlacklisted(token);
    const isBlacklisted = false; //TODO: Placeholder until blacklist logic is implemented
    if (isBlacklisted) {
      return sendErrorResponse(
        res,
        "Token has been revoked",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }

    const currentTime = Math.floor(Date.now() / 1000);
    if (decoded.exp && decoded.exp < currentTime) {
      return sendErrorResponse(
        res,
        "Token has expired",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.TOKEN_EXPIRED
      );
    }

    if (decoded.tokenId) {
      const admin = await Admin.findById(decoded.adminId).select(
        "+activeTokenId +permissions"
      );

      if (!admin) {
        return sendErrorResponse(
          res,
          "Admin not found",
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      if (admin.activeTokenId !== decoded.tokenId) {
        logger.warn("Invalid session - token not active", {
          adminId: decoded.adminId,
          tokenId: decoded.tokenId,
          activeTokenId: admin.activeTokenId,
        });

        return sendErrorResponse(
          res,
          "Session expired. Please login again.",
          HTTP_STATUS.UNAUTHORIZED,
          ERROR_CODES.INVALID_TOKEN
        );
      }

      req.admin = {
        id: decoded.id,
        adminId: decoded.adminId,
        email: decoded.email,
        adminLevel: decoded.adminLevel,
        permissions: admin.permissions || [],
      };
    } else {
      req.admin = {
        id: decoded.id,
        adminId: decoded.adminId,
        email: decoded.email,
        adminLevel: decoded.adminLevel,
        permissions: [],
      };
    }

    return next();
  } catch (error) {
    logger.error("Admin token verification error:", error);
    return sendErrorResponse(
      res,
      `Token verification failed: ${error}`,
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.INVALID_TOKEN
    );
  }
};
/**
 * Authorization middleware for admin routes
 * Checks if the authenticated admin has the required permissions
 */
export const authorize = (requiredPermissions: string[]) => {
  return (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.admin) {
        return sendErrorResponse(
          res,
          "Authentication required",
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      const { admin } = req;
      const { permissions = [], adminLevel } = admin;

      // Super admins have all permissions
      if (adminLevel === "super_admin") {
        return next();
      }

      // Check if admin has any of the required permissions
      const hasPermission = requiredPermissions.some((permission) =>
        permissions.includes(permission)
      );

      if (!hasPermission) {
        logger.warn("Insufficient permissions", {
          adminId: admin.id,
          adminLevel: admin.adminLevel,
          requiredPermissions,
          adminPermissions: permissions,
          route: req.route?.path,
          method: req.method,
        });

        return sendErrorResponse(
          res,
          "Insufficient permissions to access this resource",
          HTTP_STATUS.FORBIDDEN
        );
      }

      next();
    } catch (error) {
      logger.error("Authorization error", {
        error: (error as Error).message,
        adminId: req.admin?.id,
        route: req.route?.path,
      });

      return sendErrorResponse(
        res,
        "Authorization failed",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  };
};

/**
 * Check if admin can manage specific admin level
 * Super admins can manage all levels
 * Admins can only manage moderators
 * Moderators cannot manage other admins
 */
export const canManageAdminLevel = (targetAdminLevel: string) => {
  return (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.admin) {
        return sendErrorResponse(
          res,
          "Authentication required",
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      const { adminLevel } = req.admin;

      const adminHierarchy: Record<string, string[]> = {
        super_admin: ["super_admin", "admin", "moderator"],
        admin: ["moderator"],
        moderator: [],
      };

      const canManage = adminHierarchy[adminLevel]?.includes(targetAdminLevel);

      if (!canManage) {
        logger.warn("Insufficient level to manage target admin", {
          adminId: req.admin.id,
          adminLevel,
          targetAdminLevel,
        });

        return sendErrorResponse(
          res,
          "Insufficient admin level to perform this action",
          HTTP_STATUS.FORBIDDEN
        );
      }

      return next();
    } catch (error) {
      logger.error("Admin level check error", {
        error: (error as Error).message,
        adminId: req.admin?.id,
      });

      return sendErrorResponse(
        res,
        "Authorization failed",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  };
};

// Prevent admins from modifying their own account in certain ways
export const preventSelfModification = (
  req: AdminAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { adminId } = req.params;
    const currentAdminId = req.admin?.id;

    if (adminId === currentAdminId) {
      return sendErrorResponse(
        res,
        "Cannot perform this action on your own account",
        HTTP_STATUS.FORBIDDEN
      );
    }

    return next();
  } catch (error) {
    logger.error("Self modification check error", {
      error: (error as Error).message,
      adminId: req.admin?.id,
    });

    return sendErrorResponse(
      res,
      "Authorization failed",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
};

export const requireRole = (allowedRoles: string[]) => {
  return (
    req: AdminAuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      if (!req.admin) {
        return sendErrorResponse(
          res,
          "Authentication required",
          HTTP_STATUS.UNAUTHORIZED
        );
      }

      const { adminLevel } = req.admin;

      if (!allowedRoles.includes(adminLevel)) {
        logger.warn("Insufficient role", {
          adminId: req.admin.id,
          adminLevel,
          allowedRoles,
          route: req.route?.path,
        });

        return sendErrorResponse(
          res,
          "Insufficient role to access this resource",
          HTTP_STATUS.FORBIDDEN
        );
      }

      return next();
    } catch (error) {
      logger.error("Role check error", {
        error: (error as Error).message,
        adminId: req.admin?.id,
      });

      return sendErrorResponse(
        res,
        "Authorization failed",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  };
};
