import Joi from 'joi';

export const buyCryptoSchema = Joi.object({
  cryptoId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  walletAddress: Joi.string().required(),
  network: Joi.object().required(),
});

export const sellCryptoSchema = Joi.object({
  cryptoId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  comment: Joi.string().optional(),
  proof: Joi.string().required(),
  bankAccountId: Joi.string().required(),
});

export const cryptoTransactionQuerySchema = Joi.object({
  tradeType: Joi.string().valid('buy', 'sell').optional(),
  status: Joi.string().valid('pending', 'success', 'failed', 'approved', 'declined').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
});
