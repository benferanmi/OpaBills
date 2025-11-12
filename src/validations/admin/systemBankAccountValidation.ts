import Joi from "joi";

export const createSystemBankAccountSchema = Joi.object({
  bankName: Joi.string().required().max(100).trim(),
  accountNumber: Joi.string().required().max(50).trim(),
  accountName: Joi.string().required().max(200).trim(),
  bankCode: Joi.string().max(20).trim(),
  status: Joi.string().valid("active", "inactive").default("active"),
});

export const updateSystemBankAccountStatusSchema = Joi.object({
  status: Joi.string().valid("active", "inactive").required(),
});
