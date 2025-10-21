import Joi from 'joi';

export const createBankAccountSchema = Joi.object({
  bankId: Joi.string().required(),
  accountNumber: Joi.string().min(10).max(10).required(),
  accountName: Joi.string().required(),
  recipientCode: Joi.string().optional(),
});
