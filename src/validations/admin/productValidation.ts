import Joi from 'joi';

export const createProductValidation = Joi.object({
  name: Joi.string().required().max(200).trim(),
  serviceId: Joi.string().required(),
  description: Joi.string().max(500).trim(),
  price: Joi.number().positive(),
  code: Joi.string().max(100).trim(),
  status: Joi.string().valid('active', 'inactive').default('active'),
  meta: Joi.object(),
});

export const updateProductValidation = Joi.object({
  name: Joi.string().max(200).trim(),
  serviceId: Joi.string(),
  description: Joi.string().max(500).trim(),
  price: Joi.number().positive(),
  code: Joi.string().max(100).trim(),
  status: Joi.string().valid('active', 'inactive'),
  meta: Joi.object(),
});