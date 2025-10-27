import { Response } from 'express';
import { HTTP_STATUS } from './constants';

export interface SuccessResponse<T> {
  success: true;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

export interface ErrorResponse {
  success: false;
  message: string;
  error?: string;
  details?: any;
  timestamp: string;
  path: string;
}

export interface PaginatedResponse<T> {
  success: true;
  message: string;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  timestamp: string;
  path: string;
}

export const sendSuccessResponse = <T>(
  res: Response,
  data: T,
  message: string = "Success",
  statusCode: number = HTTP_STATUS.OK
): Response => {
  const response: SuccessResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    path: res.req.originalUrl,
  };
  return res.status(statusCode).json(response);
};

export const sendErrorResponse = (
  res: Response,
  message: string,
  statusCode: number = HTTP_STATUS.BAD_REQUEST,
  error?: string,
  details?: any
): Response => {
  const response: ErrorResponse = {
    success: false,
    message,
    error,
    details,
    timestamp: new Date().toISOString(),
    path: res.req.originalUrl,
  };
  return res.status(statusCode).json(response);
};

export const sendPaginatedResponse = <T>(
  res: Response,
  data: T[],
  pagination: {
    total: number;
    page: number;
    limit: number;
  },
  message: string = "Success"
): Response => {
  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const response: PaginatedResponse<T> = {
    success: true,
    message,
    data,
    pagination: {
      ...pagination,
      totalPages,
      hasNext: pagination.page < totalPages,
      hasPrev: pagination.page > 1,
    },
    timestamp: new Date().toISOString(),
    path: res.req.originalUrl,
  };
  return res.status(HTTP_STATUS.OK).json(response);
};

// Reference generation helper
export const generateReference = (prefix: string = 'TXN'): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

// RefCode generation helper
export const generateRefCode = (length: number = 8): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};
