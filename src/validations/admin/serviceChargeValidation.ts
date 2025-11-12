import Joi from "joi";

export const createServiceChargeValidationSchema = Joi.object({
  serviceId: Joi.string().required(),
  chargeType: Joi.string().valid("percentage", "fixed").required(),
  chargeValue: Joi.number().required().min(0),
  minCharge: Joi.number().min(0).default(0),
  maxCharge: Joi.number().min(0),
  status: Joi.string().valid("active", "inactive").default("active"),
});

export const updateServiceChargeValidationSchema = Joi.object({
  chargeType: Joi.string().valid("percentage", "fixed"),
  chargeValue: Joi.number().min(0),
  minCharge: Joi.number().min(0),
  maxCharge: Joi.number().min(0),
  status: Joi.string().valid("active", "inactive"),
});
