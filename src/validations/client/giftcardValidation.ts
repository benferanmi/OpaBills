import Joi from "joi";

// STEP 4: Breakdown validation
export const breakdownSchema = Joi.object({
  giftCardId: Joi.string().required().messages({
    "string.empty": "Product ID is required",
    "any.required": "Product ID is required",
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    "number.base": "Quantity must be a number",
    "number.min": "Quantity must be at least 1",
    "any.required": "Quantity is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.base": "Amount must be a number",
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  tradeType: Joi.string().valid("buy", "sell").required().messages({
    "string.empty": "Trade type is required",
    "any.only": 'Trade type must be either "buy" or "sell"',
    "any.required": "Trade type is required",
  }),
});

// STEP 5: Buy gift card validation
export const buyGiftCardSchema = Joi.object({
  giftCardId: Joi.string().required().messages({
    "string.empty": "Giftcard ID is required",
    "any.required": "Giftcard ID is required",
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    "number.base": "Quantity must be a number",
    "number.min": "Quantity must be at least 1",
    "any.required": "Quantity is required",
  }),
  pin: Joi.number().required().messages({
    "number.base": "Pin must be a number",
    "any.required": "Pin is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.base": "Unit price must be a number",
    "number.positive": "Unit price must be positive",
    "any.required": "Unit price is required",
  }),
  // recipientEmail: Joi.string().email().optional().messages({
  //   "string.email": "Recipient email must be a valid email address",
  // }),
  // recipientPhone: Joi.object({
  //   countryCode: Joi.string().required().messages({
  //     "string.empty": "Country code is required",
  //     "any.required": "Country code is required",
  //   }),
  //   number: Joi.string().required().messages({
  //     "string.empty": "Phone number is required",
  //     "any.required": "Phone number is required",
  //   }),
  // }).optional(),
});
// .or("recipientEmail", "recipientPhone")
// .messages({
//   "object.missing": "Either recipient email or phone is required",
// });

// Sell gift card validation (for future use)
export const sellGiftCardSchema = Joi.object({
  giftCardId: Joi.string().required().messages({
    "string.empty": "Gift card ID is required",
    "any.required": "Gift card ID is required",
  }),
  amount: Joi.number().positive().required().messages({
    "number.base": "Amount must be a number",
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  pin: Joi.number().required().messages({
    "number.base": "Pin must be a number",
    "any.required": "Pin is required",
  }),
  quantity: Joi.number().integer().min(1).required().messages({
    "number.base": "Quantity must be a number",
    "number.min": "Quantity must be at least 1",
    "any.required": "Quantity is required",
  }),
  cardType: Joi.string().valid("physical", "ecode").required().messages({
    "string.empty": "Card type is required",
    "any.only": 'Card type must be either "physical" or "ecode"',
    "any.required": "Card type is required",
  }),
  card: Joi.string().required().messages({
    "string.empty": "Card details are required",
    "any.required": "Card details are required",
  }),
  comment: Joi.string().max(500).optional().messages({
    "string.max": "Comment must not exceed 500 characters",
  }),
  bankAccountId: Joi.string().required().messages({
    "string.empty": "Bank account ID is required",
    "any.required": "Bank account ID is required",
  }),
});

// Bulk buy validation (for future use)
export const bulkBuyGiftCardSchema = Joi.object({
  items: Joi.array()
    .items(
      Joi.object({
        giftCardId: Joi.string().required(),
        amount: Joi.number().positive().required(),
        quantity: Joi.number().integer().min(1).required(),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one item is required",
      "any.required": "Items are required",
    }),
});

// Transaction query validation
export const giftCardTransactionQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(10),
  tradeType: Joi.string().valid("buy", "sell").optional(),
  status: Joi.string()
    .valid("pending", "success", "failed", "processing")
    .optional(),
  startDate: Joi.date().iso().optional(),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).optional().messages({
    "date.min": "End date must be after start date",
  }),
});
