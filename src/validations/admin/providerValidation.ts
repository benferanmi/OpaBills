import Joi from 'joi';

export const createProviderValidation = Joi.object({
  name: Joi.string().required().max(100).trim(),
  slug: Joi.string().required().max(100).trim().lowercase(),
  description: Joi.string().max(500).trim(),
  apiUrl: Joi.string().uri(),
  apiKey: Joi.string(),
  apiSecret: Joi.string(),
  status: Joi.string().valid('active', 'inactive').default('active'),
  config: Joi.object(),
});

export const updateProviderValidation = Joi.object({
  name: Joi.string().max(100).trim(),
  description: Joi.string().max(500).trim(),
  apiUrl: Joi.string().uri(),
  apiKey: Joi.string(),
  apiSecret: Joi.string(),
  status: Joi.string().valid('active', 'inactive'),
  config: Joi.object(),
});