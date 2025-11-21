import Joi from "joi";

export const createTransactionSchema = Joi.object({
  amount: Joi.number().positive().required(),
  type: Joi.string().required(),
  provider: Joi.string().required(),
  remark: Joi.string().optional(),
  purpose: Joi.string().optional(),
  meta: Joi.object().optional(),
});

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  type: Joi.string().valid("both", "sell", "buy").optional(),
  status: Joi.string()
    .valid("pending", "success", "failed", "reversed")
    .optional(),
  date: Joi.date().optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
  reference: Joi.string().optional(),
  direction: Joi.string().valid("DEBIT", "CREDIT").optional(),
  purpose: Joi.string()
    .valid(
      "airtime",
      "data",
      "electricity",
      "tv_subscription",
      "betting",
      "education",
      "internationalAirtime",
      "internationalData",
      "gift_card",
      "crypto",
      "flight",
      "wallet_transfer",
      "wallet_funding",
      "withdrawal"
    )
    .optional(),
  startPrice: Joi.number().positive().optional(),
  endPrice: Joi.number().positive().optional(),
});
