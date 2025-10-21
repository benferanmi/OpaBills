import Joi from 'joi';

export const createTransactionSchema = Joi.object({
  amount: Joi.number().positive().required(),
  type: Joi.string().required(),
  provider: Joi.string().required(),
  remark: Joi.string().optional(),
  purpose: Joi.string().optional(),
  meta: Joi.object().optional(),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});
