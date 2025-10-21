import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { sendErrorResponse } from '@/utils/helpers';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

export const validateRequest = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return sendErrorResponse(
        res,
        'Validation failed',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        details
      );
    }
    
    next();
  };
};

export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.query, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return sendErrorResponse(
        res,
        'Query validation failed',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        details
      );
    }
    
    next();
  };
};

export const validateParams = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.params, { abortEarly: false });
    
    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
      }));
      
      return sendErrorResponse(
        res,
        'Parameter validation failed',
        HTTP_STATUS.UNPROCESSABLE_ENTITY,
        ERROR_CODES.VALIDATION_ERROR,
        details
      );
    }
    
    next();
  };
};
