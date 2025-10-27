import Joi from 'joi';

export const createWithdrawalRequestSchema = Joi.object({
  amount: Joi.number().positive().required(),
  bankAccountId: Joi.string().required(),
  provider: Joi.string().default('manual'),
});

export const withdrawalQuerySchema = Joi.object({
  status: Joi.string().valid('pending', 'approved', 'declined').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});
