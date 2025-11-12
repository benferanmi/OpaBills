import Joi from 'joi';

export const createAlertValidation = Joi.object({
  title: Joi.string().required().max(200).trim(),
  message: Joi.string().required().max(1000).trim(),
  type: Joi.string().valid('info', 'warning', 'success', 'error').default('info'),
  status: Joi.string().valid('pending', 'sent').default('pending'),
});

export const updateAlertValidation = Joi.object({
  title: Joi.string().max(200).trim(),
  message: Joi.string().max(1000).trim(),
  type: Joi.string().valid('info', 'warning', 'success', 'error'),
  status: Joi.string().valid('pending', 'sent'),
});