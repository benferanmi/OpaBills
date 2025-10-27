import Joi, { date } from "joi";

export const walletTypeSchema = Joi.object({
  type: Joi.string().valid("main", "bonus", "commission").optional(),
});

export const creditWalletSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: Joi.string().required(),
  walletType: Joi.string().valid("main", "bonus", "commission").optional(),
});

export const debitWalletSchema = Joi.object({
  amount: Joi.number().positive().required(),
  reason: Joi.string().required(),
  walletType: Joi.string().valid("main", "bonus", "commission").optional(),
});

export const generateVirtualAccountSchema = Joi.object({
  identificationType: Joi.string().valid("bvn", "nin").required(),
  type: Joi.string().valid("permanent", "temporary").default("permanent"),
  value: Joi.string().required(),
  firstname: Joi.string().required(),
  lastname: Joi.string().required(),
  // dateOfBirth: Joi.date().required(),
});

export const fundWalletSchema = Joi.object({
  amount: Joi.number().positive().required(),
  walletType: Joi.string()
    .valid("main", "bonus", "commission")
    .optional()
    .default("main"),
  provider: Joi.string()
    .valid("paystack", "monify", "flutterwave", "saveHaven")
    .default("flutterwave"),
  method: Joi.string().valid("card", "bank").default("card"),
});

export const bankTransferSchema = Joi.object({
  amount: Joi.number().positive().required().messages({
    "any.required": "Amount is required",
  }),
  bankCode: Joi.string().required().messages({
    "any.required": "Bank code is required",
  }),
  accountName: Joi.string().required().messages({
    "any.required": "Account name is required",
  }),
  accountNumber: Joi.string().required().messages({
    "any.required": "Account number is required",
  }),
  pin: Joi.string().required().length(4).pattern(/^\d+$/).messages({
    "any.required": "Pin is required",
    "string.length": "Pin must be exactly 4 digits",
    "string.pattern.base": "Pin must contain only numbers",
  }),
  provider: Joi.string()
    .valid("paystack", "monify", "flutterwave", "saveHaven")
    .default("flutterwave")
    .messages({
      "any.required": "Provider is required",
    }),
});
