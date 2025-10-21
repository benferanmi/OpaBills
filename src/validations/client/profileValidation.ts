import Joi from "joi";

export const updateProfileSchema = Joi.object({
  firstname: Joi.string().min(2).max(50).optional(),
  lastname: Joi.string().min(2).max(50).optional(),
  phone: Joi.string().optional(),
  phoneCode: Joi.string().optional(),
  gender: Joi.string().valid("male", "female", "other").optional(),
  country: Joi.string().optional(),
  state: Joi.string().optional(),
  avatar: Joi.string().uri().optional(),
  fcmToken: Joi.string().optional().allow(""),
});

export const toogleBiometricSchema = Joi.object({
  enable: Joi.boolean().required().messages({
    "any.required": "Enabled is required",
  }),
  type: Joi.string().valid("login", "transaction").required().messages({
    "any.required": "Biometric type is required",
    "any.only": "Biometric type must be either 'login' or 'transaction'",
  }),
});
