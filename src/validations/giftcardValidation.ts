import Joi from 'joi';

export const buyGiftCardSchema = Joi.object({
  giftCardId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  quantity: Joi.number().integer().min(1).optional().default(1),
});

export const sellGiftCardSchema = Joi.object({
  giftCardId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  quantity: Joi.number().integer().min(1).required(),
  cardType: Joi.string().required(),
  card: Joi.string().required(),
  pin: Joi.string().optional(),
  comment: Joi.string().optional(),
  bankAccountId: Joi.string().required(),
});

export const bulkBuyGiftCardSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        giftCardId: Joi.string().required(),
        amount: Joi.number().positive().required(),
        quantity: Joi.number().integer().min(1).optional().default(1),
      })
    )
    .min(1)
    .required(),
});

export const giftCardTransactionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  tradeType: Joi.string().valid('buy', 'sell').optional(),
  status: Joi.string().valid('pending', 'success', 'failed', 'approved', 'declined').optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().optional(),
});
