import Joi from 'joi';

export const createFaqValidation = Joi.object({
  question: Joi.string().required().max(500).trim(),
  answer: Joi.string().required().max(2000).trim(),
  categoryId: Joi.string(),
  status: Joi.string().valid('active', 'inactive').default('active'),
  order: Joi.number().integer().min(0).default(0),
});

export const updateFaqValidation = Joi.object({
  question: Joi.string().max(500).trim(),
  answer: Joi.string().max(2000).trim(),
  categoryId: Joi.string(),
  status: Joi.string().valid('active', 'inactive'),
  order: Joi.number().integer().min(0),
});