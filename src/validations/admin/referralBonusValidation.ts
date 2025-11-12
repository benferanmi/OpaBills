import Joi from "joi";

export const createReferralBonusValidation = Joi.object({
  referrerBonus: Joi.number().required().min(0),
  refereeBonus: Joi.number().required().min(0),
  minimumTransactionAmount: Joi.number().min(0).default(0),
  status: Joi.string().valid("active", "inactive").default("active"),
});

export const updateReferralBonusValidation = Joi.object({
  referrerBonus: Joi.number().min(0),
  refereeBonus: Joi.number().min(0),
  minimumTransactionAmount: Joi.number().min(0),
  status: Joi.string().valid("active", "inactive"),
});

export const updateReferralBonusTermsValidation = Joi.object({
  terms: Joi.string().required().max(5000).trim(),
  status: Joi.string().valid("active", "inactive"),
});
