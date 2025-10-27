import { Response, NextFunction } from 'express';
import { AuthRequest } from '@/middlewares/auth';
import { UserRepository } from '@/repositories/UserRepository';
import { sendErrorResponse } from '@/utils/helpers';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

const userRepository = new UserRepository();

export const profileComplete = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const user = await userRepository.findById(userId);
    
    if (!user) {
      return sendErrorResponse(
        res,
        'User not found',
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }
    
    // Check if required profile fields are completed
    if (!user.firstName || !user.lastName || !user.phone || !user.emailVerifiedAt) {
      return sendErrorResponse(
        res,
        'Please complete your profile before performing this action',
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.PROFILE_INCOMPLETE
      );
    }
    
    next();
  } catch (error) {
    next(error);
  }
};
