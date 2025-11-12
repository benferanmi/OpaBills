import Joi from 'joi';

export const createBannerValidation = Joi.object({
  title: Joi.string().required().max(200).trim(),
  description: Joi.string().max(500).trim(),
  imageUrl: Joi.string().uri().required(),
  linkUrl: Joi.string().uri(),
  activatedAt: Joi.date().required(),
  expiresAt: Joi.date().greater(Joi.ref('activatedAt')),
});

export const updateBannerValidation = Joi.object({
  title: Joi.string().max(200).trim(),
  description: Joi.string().max(500).trim(),
  imageUrl: Joi.string().uri(),
  linkUrl: Joi.string().uri(),
  activatedAt: Joi.date(),
  expiresAt: Joi.date(),
});