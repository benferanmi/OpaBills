import Joi from "joi";

export const registerSchema = Joi.object({
  firstname: Joi.string().min(2).max(50).required(),
  lastname: Joi.string().min(2).max(50).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required(),
  phone: Joi.string().optional(),
  phoneCode: Joi.string().optional(),
  username: Joi.string().alphanum().min(3).max(20).optional(),
  referralCode: Joi.string().optional().allow(""),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "any.required": "Email is required",
    "string.empty": "Email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
    "string.empty": "Password is required",
  }),
  fcmToken: Joi.string().optional().messages({
    "any.required": "FCM token is required",
  }),
});

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const resetPasswordSchema = Joi.object({
  otp: Joi.string().required(),
  password: Joi.string().min(8).required(),
  gmail: Joi.string().email().optional(),
});

export const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required().messages({
    "any.required": "Old password is required",
  }),
  newPassword: Joi.string().min(8).required().messages({
    "string.min": "New password must be at least 8 characters long",
    "any.required": "New password is required",
  }),
});

export const changeAppPasswordSchema = Joi.object({
  newPassword: Joi.string().min(8).required(),
  email: Joi.string().email().optional(),
});
export const verifyOTPAppSchema = Joi.object({
  otp: Joi.string().length(6).required(),
  email: Joi.string().email().optional(),
});
export const verifyOTPSchema = Joi.object({
  otp: Joi.string().length(6).required(),
  email: Joi.string().email().optional(),
  phone: Joi.string().optional(),
  phoneCode: Joi.string().optional(),
});

export const phoneNumberVerificationSchema = Joi.object({
  phone: Joi.string().required().messages({
    "any.required": "Phone number is required",
  }),
  phoneCode: Joi.string().required().messages({
    "any.required": "Phone code is required",
  }),
});

export const updatePinSchema = Joi.object({
  pin: Joi.string().length(4).pattern(/^\d+$/).required(),
  password: Joi.string().required(),
});

export const changePinSchema = Joi.object({
  oldPin: Joi.string().length(4).pattern(/^\d+$/).required(),
  newPin: Joi.string().length(4).pattern(/^\d+$/).required(),
});

export const setPinSchema = Joi.object({
  pin: Joi.string().length(4).pattern(/^\d+$/).required(),
});

export const verifyPinSchema = Joi.object({
  pin: Joi.string().length(4).pattern(/^\d+$/).required(),
});

export const toggle2FASchema = Joi.object({
  enable: Joi.boolean().required(),
});
