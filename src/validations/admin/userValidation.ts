import Joi from 'joi';

export const updateUserStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'suspended').required(),
});

export const markFraudulentSchema = Joi.object({
  reason: Joi.string().min(10).required(),
});

export const manageWalletSchema = Joi.object({
  action: Joi.string().valid('credit', 'debit').required(),
  amount: Joi.number().positive().required(),
  type: Joi.string().valid('main', 'bonus', 'commission').required(),
  remark: Joi.string().optional(),
});
