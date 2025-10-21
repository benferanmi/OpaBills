import { Request, Response, NextFunction } from 'express';
import { sendErrorResponse } from '@/utils/helpers';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    public errorCode: string = ERROR_CODES.INTERNAL_ERROR,
    public details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof AppError) {
    return sendErrorResponse(
      res,
      err.message,
      err.statusCode,
      err.errorCode,
      err.details
    );
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return sendErrorResponse(
      res,
      'Validation error',
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      err.message
    );
  }

  // Mongoose duplicate key error
  if (err.name === 'MongoServerError' && (err as any).code === 11000) {
    return sendErrorResponse(
      res,
      'Duplicate entry',
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.DUPLICATE_ENTRY
    );
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return sendErrorResponse(
      res,
      'Invalid token',
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.INVALID_TOKEN
    );
  }

  if (err.name === 'TokenExpiredError') {
    return sendErrorResponse(
      res,
      'Token expired',
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.TOKEN_EXPIRED
    );
  }

  // Default error
  console.error('Unhandled error:', err);
  return sendErrorResponse(
    res,
    'Internal server error',
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.INTERNAL_ERROR
  );
};
