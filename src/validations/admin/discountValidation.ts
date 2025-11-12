import Joi from 'joi';

export const createDiscountValidation = Joi.object({
  code: Joi.string().required().uppercase().max(50).trim(),
  description: Joi.string().max(500).trim(),
  discountType: Joi.string().valid('percentage', 'fixed').required(),
  discountValue: Joi.number().required().min(0),
  serviceId: Joi.string(),
  minTransactionAmount: Joi.number().min(0).default(0),
  maxDiscount: Joi.number().min(0),
  maxUsage: Joi.number().min(1),
  usageCount: Joi.number().min(0).default(0),
  validFrom: Joi.date(),
  validUntil: Joi.date(),
  status: Joi.string().valid('active', 'inactive', 'expired').default('active'),
});

export const updateDiscountValidation = Joi.object({
  code: Joi.string().uppercase().max(50).trim(),
  description: Joi.string().max(500).trim(),
  discountType: Joi.string().valid('percentage', 'fixed'),
  discountValue: Joi.number().min(0),
  serviceId: Joi.string(),
  minTransactionAmount: Joi.number().min(0),
  maxDiscount: Joi.number().min(0),
  maxUsage: Joi.number().min(1),
  usageCount: Joi.number().min(0),
  validFrom: Joi.date(),
  validUntil: Joi.date(),
  status: Joi.string().valid('active', 'inactive', 'expired'),
});