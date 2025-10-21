import Joi from 'joi';

export const walletTypeSchema = Joi.object({
  type: Joi.string().valid('main', 'bonus', 'commission').optional().default('main'),
});

export const creditWalletSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: Joi.string().required(),
  walletType: Joi.string().valid('main', 'bonus', 'commission').optional(),
});

export const debitWalletSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: Joi.string().required(),
  walletType: Joi.string().valid('main', 'bonus', 'commission').optional(),
});
