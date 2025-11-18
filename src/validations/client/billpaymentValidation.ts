import Joi, { number } from "joi";

export const airtimePurchaseSchema = Joi.object({
  phone: Joi.string().required().messages({
    "any.required": "Phone number is required",
    "string.empty": "Phone number is required",
  }),
  amount: Joi.number().positive().required().messages({
    "any.required": "Amount is required",
  }),
  provider: Joi.string().required().messages({
    "any.required": "Provider is required",
  }),
  pin: Joi.string().required().messages({
    "any.required": "Pin is required",
  }),
});

export const dataPurchaseSchema = Joi.object({
  phone: Joi.string().required().messages({
    "any.required": "Phone number is required",
    "string.empty": "Phone number is required",
  }),
  productId: Joi.string().required(),
  pin: Joi.string().required().messages({
    "any.required": "Pin is required",
  }),
});

export const purchaseInternationAirtimeSchema = Joi.object({
  phone: Joi.string().required().messages({
    "any.required": "Phone number is required",
    "string.empty": "Phone number is required",
  }),
  productCode: Joi.string().required().messages({
    "any.required": "Provider is required",
    "string.empty": "Provider is not allowed to be empty",
  }),
  operatorId: Joi.string().required().messages({
    "any.required": "Operator is required",
    "string.empty": "Operator is not allowed to be empty",
  }),
  countryCode: Joi.string().required().messages({
    "any.required": "Country code is required",
    "string.empty": "Country code is not allowed to be empty",
  }),
  amount: Joi.number().positive().required().messages({
    "any.required": "Amount is required",
    "string.empty": "Amount is not allowed to be empty",
  }),
  pin: Joi.number().required().messages({
    "any.required": "Pin is required",
    "string.empty": "Pin is not allowed to be empty",
  }),
});

export const purchaseInternationDataSchema = Joi.object({
  phone: Joi.string().required().messages({
    "any.required": "Phone number is required",
    "string.empty": "Phone number is required",
  }),
  productCode: Joi.string().required().messages({
    "any.required": "Provider is required",
    "string.empty": "Provider is not allowed to be empty",
  }),
  operatorId: Joi.string().required().messages({
    "any.required": "Operator is required",
    "string.empty": "Operator is not allowed to be empty",
  }),
  countryCode: Joi.string().required().messages({
    "any.required": "Country code is required",
    "string.empty": "Country code is not allowed to be empty",
  }),
  amount: Joi.number().positive().required().messages({
    "any.required": "Amount is required",
    "string.empty": "Amount is not allowed to be empty",
  }),
  pin: Joi.number().required().messages({
    "any.required": "Pin is required",
    "string.empty": "Pin is not allowed to be empty",
  }),
});

export const cableTvSchema = Joi.object({
  number: Joi.string().required(),
  productId: Joi.string().required(),
  provider: Joi.string().required().messages({
    "any.required": "Provider is required",
  }),
  type: Joi.string().valid("renew", "change").required(),
  pin: Joi.number().required().messages({
    "any.required": "Pin is required",
    "string.empty": "Pin is not allowed to be empty",
  }),
});
export const verifyEPinSchema = Joi.object({
  number: Joi.number().required().messages({
    "any.required": "Number is required",
    "string.empty": "Number is not allowed to be empty",
  }),
  type: Joi.string().required().messages({
    "any.required": "Type is required",
    "string.empty": "Type is not allowed to be empty",
  }),
});

export const purchaseEpinSchema = Joi.object({
  number: Joi.number().required().messages({
    "any.required": "Number is required",
    "string.empty": "Number is not allowed to be empty",
  }),
  productId: Joi.string().required().messages({
    "any.required": "ProuctId is required",
    "string.empty": "ProductId is not allowed to be empty",
  }),
  pin: Joi.string().required().messages({
    "any.required": "Pin is required",
  }),
});

export const verifySmartCardNumberSchema = Joi.object({
  number: Joi.number().required().messages({
    "any:required": "Number is required",
    "string.empty": "Number is not allowed to be empty",
  }),
  provider: Joi.string().required().messages({
    "any.required": "Provider is required",
    "string.empty": "Provider is not allowed to be empty",
  }),
});

export const verifyElectricitySchema = Joi.object({
  providerCode: Joi.string().required().messages({
    "any.required": "Provider is required",
    "string.empty": "Provider is not allowed to be empty",
  }),
  type: Joi.string().required().valid("prepaid", "postpaid").messages({
    "any.required": "Type is required",
    "string.empty": "Type is not allowed to be empty",
    "any.only": "Type must be either 'prepaid' or 'postpaid'",
  }),
  number: Joi.string().required().messages({
    "any.required": "Number is required",
    "string.empty": "Number is not allowed to be empty",
  }),
});

export const electricitySchema = Joi.object({
  providerId: Joi.string().required().messages({
    "any.required": "Provider is required",
    "string.empty": "Provider is not allowed to be empty",
  }),
  type: Joi.string().required().valid("prepaid", "postpaid").messages({
    "any.required": "Type is required",
    "string.empty": "Type is not allowed to be empty",
    "any.only": "Type must be either 'prepaid' or 'postpaid'",
  }),
  number: Joi.string().required().messages({
    "any.required": "Number is required",
    "string.empty": "Number is not allowed to be empty",
  }),
  amount: Joi.number().positive().required().messages({
    "any.required": "Amount is required",
    "string.empty": "Amount is not allowed to be empty",
  }),
  pin: Joi.number().required().messages({
    "any.required": "Pin is required",
    "string.empty": "Pin is not allowed to be empty",
  }),
});

export const transactionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  type: Joi.string().optional(),
  status: Joi.string()
    .valid("pending", "success", "failed", "reversed")
    .optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});

export const verifyPhoneNumberSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^0\d{10}$/)
    .required()
    .messages({
      "any.required": "Phone number is required",
      "string.pattern.base": "Invalid phone number",
    }),
  network: Joi.string().optional(),
});

export const bettingPurchaseSchema = Joi.object({
  providerId: Joi.string().required().messages({
    "any.required": "ProviderId is required",
    "string.empty": "ProviderId is required",
  }),
  amount: Joi.number().positive().required().messages({
    "any.required": "Amount is required",
  }),
  number: Joi.string().required().messages({
    "any.required": "Number is required",
    "string.empty": "Number is not allowed to be empty",
  }),
  pin: Joi.string().required().messages({
    "any.required": "Pin is required",
  }),
});
