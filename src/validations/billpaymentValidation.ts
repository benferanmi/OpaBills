import Joi from 'joi';

export const airtimePurchaseSchema = Joi.object({
  phone: Joi.string().required(),
  phoneCode: Joi.string().optional(),
  amount: Joi.number().positive().required(),
  providerId: Joi.string().required(),
  serviceId: Joi.string().required(),
});

export const dataPurchaseSchema = Joi.object({
  phone: Joi.string().required(),
  phoneCode: Joi.string().optional(),
  productId: Joi.string().required(),
  amount: Joi.number().positive().required(),
});

export const cableTvSchema = Joi.object({
  smartCardNumber: Joi.string().required(),
  productId: Joi.string().required(),
  amount: Joi.number().positive().required(),
});

export const electricitySchema = Joi.object({
  meterNumber: Joi.string().required(),
  productId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  meterType: Joi.string().valid('prepaid', 'postpaid').required(),
});

export const transactionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  type: Joi.string().optional(),
  status: Joi.string().valid('pending', 'success', 'failed', 'reversed').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});
