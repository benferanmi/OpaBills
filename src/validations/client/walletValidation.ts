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
  dateOfBirth: Joi.date().required(),
});

export const fundWalletSchema = Joi.object({
  amount: Joi.number().positive().required(),
  provider: Joi.string()
    .valid("monnify", "flutterwave", "saveHaven")
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
    .valid("monnify", "flutterwave", "saveHaven")
    .default("flutterwave")
    .messages({
      "any.required": "Provider is required",
    }),
});

export const identificationSchema = Joi.object({
  identificationType: Joi.string().valid("bvn", "nin").required().messages({
    "any.required": "identificationType is required",
    "any.only": "identificationType must be either 'bvn' or 'nin'",
  }),

  value: Joi.string().trim().pattern(/^\d+$/).length(11).required().messages({
    "any.required": "value is required",
    "string.pattern.base": "{{#label}} must contain only digits",
    "string.length": "{{#label}} must be exactly 11 digits",
  }),

  firstname: Joi.string()
    .pattern(/^[a-zA-Z\s\-']+$/)
    .required()
    .messages({
      "any.required": "firstname is required",
      "string.pattern.base": "firstname contains invalid characters",
    }),

  middlename: Joi.string()
    .allow(null, "")
    .pattern(/^[a-zA-Z\s\-']+$/)
    .messages({
      "string.pattern.base": "middlename contains invalid characters",
    }),

  lastname: Joi.string()
    .pattern(/^[a-zA-Z\s\-']+$/)
    .required()
    .messages({
      "any.required": "lastname is required",
      "string.pattern.base": "lastname contains invalid characters",
    }),

  dateOfBirth: Joi.string()
    .pattern(/^\d{4}-\d{2}-\d{2}$/)
    .required()
    .custom((value, helpers) => {
      const birthDate = new Date(value);
      const now = new Date();

      if (isNaN(birthDate.getTime())) {
        return helpers.error("any.invalid", { message: "Invalid date format" });
      }

      if (birthDate > now) {
        return helpers.error("any.invalid", {
          message: "dateOfBirth cannot be in the future",
        });
      }

      const age = now.getFullYear() - birthDate.getFullYear();
      const hasBirthdayPassed =
        now.getMonth() > birthDate.getMonth() ||
        (now.getMonth() === birthDate.getMonth() &&
          now.getDate() >= birthDate.getDate());
      const actualAge = hasBirthdayPassed ? age : age - 1;

      if (actualAge < 18) {
        return helpers.error("any.invalid", {
          message: "You must be at least 18 years old to create an account",
        });
      }

      return value;
    })
    .messages({
      "any.required": "dateOfBirth is required",
      "string.pattern.base":
        "dateOfBirth must be in format YYYY-MM-DD (e.g., 1990-01-15)",
      "any.invalid": "{{#message}}",
    }),
});
