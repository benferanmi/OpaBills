import Joi from "joi";

export const createServiceTypeSchema = Joi.object({
  name: Joi.string().required().max(100).trim(),
  slug: Joi.string().required().max(100).trim().lowercase(),
  description: Joi.string().max(500).trim(),
  icon: Joi.string().max(200).trim(),
  status: Joi.string().valid("active", "inactive").default("active"),
});

export const updateServiceTypeSchema = Joi.object({
  name: Joi.string().max(100).trim(),
  slug: Joi.string().max(100).trim().lowercase(),
  description: Joi.string().max(500).trim(),
  icon: Joi.string().max(200).trim(),
  status: Joi.string().valid("active", "inactive"),
});
