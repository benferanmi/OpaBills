import Joi from "joi";

export const createRoleValidation = Joi.object({
  name: Joi.string().required().max(100).trim(),
  slug: Joi.string().required().max(100).trim().lowercase(),
  description: Joi.string().max(500).trim(),
  permissions: Joi.array().items(Joi.string()).required(),
  status: Joi.string().valid("active", "inactive").default("active"),
});

export const udpateRoleValidation = Joi.object({
  name: Joi.string().max(100).trim(),
  description: Joi.string().max(500).trim(),
  permissions: Joi.array().items(Joi.string()),
  status: Joi.string().valid("active", "inactive"),
});
