import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { UserRepository } from "@/repositories/UserRepository";
import { sendErrorResponse } from "@/utils/helpers";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { comparePassword } from "@/utils/cryptography";

const userRepository = new UserRepository();

export const checkAndVerifyPin = async (
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
        "User not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.NOT_FOUND
      );
    }

    if (!user.pin) {
      return sendErrorResponse(
        res,
        "PIN not set",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }
    const isPinValid = await comparePassword(req.body.pin, user.pin);

    if (!isPinValid) {
      return sendErrorResponse(
        res,
        "Invalid PIN",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INVALID_PIN
      );
    }

    req.userData = user;
    next();
  } catch (error) {
    next(error);
  }
};
