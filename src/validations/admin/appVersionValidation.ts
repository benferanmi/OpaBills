import Joi from 'joi';

export const createAppVersionValidation = Joi.object({
  version: Joi.string().required().max(20).trim(),
  platform: Joi.string().valid('android', 'ios', 'web').required(),
  buildNumber: Joi.number().required(),
  isForceUpdate: Joi.boolean().default(false),
  releaseNotes: Joi.string().max(1000).trim(),
  downloadUrl: Joi.string().uri().trim(),
  status: Joi.string().valid('active', 'inactive').default('active'),
});

export const updateAppVersionValidation = Joi.object({
  version: Joi.string().max(20).trim(),
  platform: Joi.string().valid('android', 'ios', 'web'),
  buildNumber: Joi.number(),
  isForceUpdate: Joi.boolean(),
  releaseNotes: Joi.string().max(1000).trim(),
  downloadUrl: Joi.string().uri().trim(),
  status: Joi.string().valid('active', 'inactive'),
});