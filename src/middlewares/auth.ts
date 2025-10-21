import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS, ERROR_CODES, CACHE_KEYS } from "@/utils/constants";
import { CacheService } from "@/services/CacheService";
import { cache } from "joi";
import { User } from "@/models/core/User";

const cacheService = new CacheService();
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendErrorResponse(
        res,
        "No token provided",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.AUTHENTICATION_ERROR
      );
    }

    const token = authHeader.substring(7);

    if (!process.env.JWT_SECRET) {
      throw new Error("JWT_SECRET is not defined");
    }

    const isBlacklisted = await cacheService.exists(
      CACHE_KEYS.TOKEN_BLACKLIST(token)
    );

    if (isBlacklisted) {
      return sendErrorResponse(
        res,
        "Token has been revoked",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.INVALID_TOKEN
      );
    }


    const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;

    const user = User.findById(decoded.id);
    
    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return sendErrorResponse(
        res,
        "Token expired",
        HTTP_STATUS.UNAUTHORIZED,
        ERROR_CODES.TOKEN_EXPIRED
      );
    }

    return sendErrorResponse(
      res,
      "Invalid token",
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.INVALID_TOKEN
    );
  }
};
