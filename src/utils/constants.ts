import RedisStore from "rate-limit-redis";
import rateLimit from "express-rate-limit";
import { CacheService } from "@/services/CacheService";
import { getRedisClient } from "@/config";

const cacheService = new CacheService();
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  LOCKED: 423,
  NOT_IMPLEMENTED: 501,
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  AUTHENTICATION_ERROR: "AUTHENTICATION_ERROR",
  AUTHORIZATION_ERROR: "AUTHORIZATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  DUPLICATE_TRANSACTION: "DUPLICATE_TRANSACTION",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  INVALID_TOKEN: "INVALID_TOKEN",
  TOKEN_REQUIRED: "TOKEN_REQUIRED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",
  ACCOUNT_INACTIVE: "ACCOUNT_INACTIVE",
  EMAIL_NOT_VERIFIED: "EMAIL_NOT_VERIFIED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  TWO_FA_REQUIRED: "TWO_FA_REQUIRED",
  WALLET_LOCKED: "WALLET_LOCKED",
  PROFILE_INCOMPLETE: "PROFILE_INCOMPLETE",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  THIRD_PARTY_ERROR: "THIRD_PARTY_ERROR",
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INVALID_PROVIDER: "INVALID_PROVIDER",
  DATABASE_ERROR: "DATABASE_ERROR",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  INVALID_PIN: "INVALID_PIN",
} as const;

export const CACHE_KEYS = {
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_WALLET: (userId: string) => `user:wallet:${userId}`,
  OTP: (identifier: string) => `otp:${identifier}`,
  TOKEN_BLACKLIST: (token: string) => `token:blacklist:${token}`,
  RATE_LIMIT: (ip: string, route: string) => `ratelimit:${ip}:${route}`,
  IDENTITY_VALIDATION: "identity:validation",
  BANKS: "banks:all",
  PROVIDERS: "providers:all",
  SERVICES: "services:all",
  PRODUCTS: "products:all",
  COUNTRIES: "countries:all",
  REFERRAL_TERMS: "referral:terms",
  FAQS: "faqs:all",
  FAQ_CATEGORIES: "faq:categories",
  BANNERS: "banners:active",
  SETTINGS: "settings:all",
  GIFTCARD_RATES: "giftcard:rates",
  CRYPTO_RATES: "crypto:rates",
} as const;

export const CACHE_TTL = {
  ONE_MINUTE: 60,
  FIVE_MINUTES: 300,
  TEN_MINUTES: 600,
  THIRTY_MINUTES: 1800,
  ONE_HOUR: 3600,
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
} as const;

export const TRANSACTION_STATUS = {
  PENDING: "pending",
  SUCCESS: "success",
  FAILED: "failed",
  REVERSED: "reversed",
} as const;

export const WALLET_TYPES = {
  MAIN: "main",
  BONUS: "bonus",
  COMMISSION: "commission",
} as const;

export const USER_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
} as const;

export const LEDGER_TYPE = {
  DEBIT: "debit",
  CREDIT: "credit",
} as const;

export const TRANSACTION_TYPES = {
  AIRTIME: "airtime",
  DATA: "data",
  CABLE: "cable",
  ELECTRICITY: "electricity",
  WALLET_FUNDING: "wallet_funding",
  WALLET_TRANSFER: "wallet_transfer",
  WITHDRAWAL: "withdrawal",
  GIFT_CARD_PURCHASE: "gift_card_purchase",
  GIFT_CARD_SALE: "gift_card_sale",
  CRYPTO_PURCHASE: "crypto_purchase",
  CRYPTO_SALE: "crypto_sale",
  FLIGHT_BOOKING: "flight_booking",
  REFERRAL_COMMISSION: "referral_commission",
} as const;

export const RATE_LIMITS = {
  // Authentication & Security
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: "Too many authentication attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  REGISTRATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: "Registration limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  OTP: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: "OTP request limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  PASSWORD_RESET: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: "Password reset limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  PIN_OPERATIONS: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: "Too many PIN attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Wallet & Financial Operations
  WALLET_FUNDING: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Wallet funding limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  WITHDRAWAL: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Withdrawal limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  TRANSFER: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30,
    message: "Transfer limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  MANUAL_DEPOSIT_REQUEST: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 10,
    message:
      "Manual deposit request limit exceeded, please try again tomorrow.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Bill Payments
  AIRTIME_PURCHASE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: "Airtime purchase limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  DATA_PURCHASE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50,
    message: "Data purchase limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  CABLE_TV: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Cable TV subscription limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  ELECTRICITY: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Electricity purchase limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  BETTING: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30,
    message: "Betting topup limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  EDUCATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Education payment limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Gift Cards & Crypto
  GIFTCARD_PURCHASE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15,
    message: "Gift card purchase limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  GIFTCARD_SALE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 15,
    message: "Gift card sale limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  CRYPTO_PURCHASE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Crypto purchase limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  CRYPTO_SALE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Crypto sale limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Flight Bookings
  FLIGHT_SEARCH: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100,
    message: "Flight search limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  FLIGHT_BOOKING: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Flight booking limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Account & Profile
  PROFILE_UPDATE: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "Profile update limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  BANK_ACCOUNT_ADD: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 5,
    message: "Bank account addition limit exceeded, please try again tomorrow.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  BANK_ACCOUNT_VERIFY: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Bank verification limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Admin Operations
  ADMIN_AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5,
    message: "Too many admin authentication attempts, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  ADMIN_OPERATIONS: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: "Admin operation limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  ADMIN_ALERT_SEND: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10,
    message: "Alert sending limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // General & Public
  GENERAL: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  PUBLIC_API: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 500,
    message: "API rate limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  FILE_UPLOAD: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    message: "File upload limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  // Transaction History & Reports
  TRANSACTION_HISTORY: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50,
    message:
      "Transaction history request limit exceeded, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  },

  WEBHOOK: {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000,
    message: "Webhook rate limit exceeded.",
    standardHeaders: true,
    legacyHeaders: false,
  },
} as const;

const createRedisRateLimiter = (
  config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS],
  prefix: string
) => {
  return rateLimit({
    ...config,
    store: new RedisStore({
      sendCommand: async (...args: string[]) => {
        const redis = getRedisClient();
        return redis.sendCommand(args);
      },
      prefix: `rl:${prefix}:`,
    }),
  });
};
const rateLimiterCache = new Map<string, any>();

const getRateLimiter = (
  config: (typeof RATE_LIMITS)[keyof typeof RATE_LIMITS],
  prefix: string
) => {
  if (!rateLimiterCache.has(prefix)) {
    rateLimiterCache.set(prefix, createRedisRateLimiter(config, prefix));
  }
  return rateLimiterCache.get(prefix);
};

export const rateLimiter = {
  // Authentication & Security
  get auth() {
    return getRateLimiter(RATE_LIMITS.AUTH, "auth");
  },
  get registration() {
    return getRateLimiter(RATE_LIMITS.REGISTRATION, "registration");
  },
  get otp() {
    return getRateLimiter(RATE_LIMITS.OTP, "otp");
  },
  get passwordReset() {
    return getRateLimiter(RATE_LIMITS.PASSWORD_RESET, "password_reset");
  },
  get pinOperations() {
    return getRateLimiter(RATE_LIMITS.PIN_OPERATIONS, "pin");
  },

  // Wallet & Financial
  get walletFunding() {
    return getRateLimiter(RATE_LIMITS.WALLET_FUNDING, "wallet_funding");
  },
  get withdrawal() {
    return getRateLimiter(RATE_LIMITS.WITHDRAWAL, "withdrawal");
  },
  get transfer() {
    return getRateLimiter(RATE_LIMITS.TRANSFER, "transfer");
  },
  get manualDepositRequest() {
    return getRateLimiter(RATE_LIMITS.MANUAL_DEPOSIT_REQUEST, "manual_deposit");
  },

  // Bill Payments
  get airtimePurchase() {
    return getRateLimiter(RATE_LIMITS.AIRTIME_PURCHASE, "airtime");
  },
  get dataPurchase() {
    return getRateLimiter(RATE_LIMITS.DATA_PURCHASE, "data");
  },
  get cableTv() {
    return getRateLimiter(RATE_LIMITS.CABLE_TV, "cable_tv");
  },
  get electricity() {
    return getRateLimiter(RATE_LIMITS.ELECTRICITY, "electricity");
  },
  get betting() {
    return getRateLimiter(RATE_LIMITS.BETTING, "betting");
  },
  get education() {
    return getRateLimiter(RATE_LIMITS.EDUCATION, "education");
  },

  // Gift Cards & Crypto
  get giftcardPurchase() {
    return getRateLimiter(RATE_LIMITS.GIFTCARD_PURCHASE, "giftcard_purchase");
  },
  get giftcardSale() {
    return getRateLimiter(RATE_LIMITS.GIFTCARD_SALE, "giftcard_sale");
  },
  get cryptoPurchase() {
    return getRateLimiter(RATE_LIMITS.CRYPTO_PURCHASE, "crypto_purchase");
  },
  get cryptoSale() {
    return getRateLimiter(RATE_LIMITS.CRYPTO_SALE, "crypto_sale");
  },

  // Flight
  get flightSearch() {
    return getRateLimiter(RATE_LIMITS.FLIGHT_SEARCH, "flight_search");
  },
  get flightBooking() {
    return getRateLimiter(RATE_LIMITS.FLIGHT_BOOKING, "flight_booking");
  },

  // Account & Profile
  get profileUpdate() {
    return getRateLimiter(RATE_LIMITS.PROFILE_UPDATE, "profile");
  },
  get bankAccountAdd() {
    return getRateLimiter(RATE_LIMITS.BANK_ACCOUNT_ADD, "bank_add");
  },
  get bankAccountVerify() {
    return getRateLimiter(RATE_LIMITS.BANK_ACCOUNT_VERIFY, "bank_verify");
  },

  // Admin
  get adminAuth() {
    return getRateLimiter(RATE_LIMITS.ADMIN_AUTH, "admin_auth");
  },
  get adminOperations() {
    return getRateLimiter(RATE_LIMITS.ADMIN_OPERATIONS, "admin_ops");
  },
  get adminAlertSend() {
    return getRateLimiter(RATE_LIMITS.ADMIN_ALERT_SEND, "admin_alert");
  },

  // General
  get general() {
    return getRateLimiter(RATE_LIMITS.GENERAL, "general");
  },
  get publicApi() {
    return getRateLimiter(RATE_LIMITS.PUBLIC_API, "public");
  },
  get fileUpload() {
    return getRateLimiter(RATE_LIMITS.FILE_UPLOAD, "upload");
  },
  get transactionHistory() {
    return getRateLimiter(RATE_LIMITS.TRANSACTION_HISTORY, "txn_history");
  },
  get webhook() {
    return getRateLimiter(RATE_LIMITS.WEBHOOK, "webhook");
  },
};
