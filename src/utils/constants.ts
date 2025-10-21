export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  ACCOUNT_INACTIVE: 'ACCOUNT_INACTIVE',
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TWO_FA_REQUIRED: 'TWO_FA_REQUIRED',
} as const;

export const CACHE_KEYS = {
  USER_PROFILE: (userId: string) => `user:profile:${userId}`,
  USER_WALLET: (userId: string) => `user:wallet:${userId}`,
  OTP: (identifier: string) => `otp:${identifier}`,
  TOKEN_BLACKLIST: (token: string) => `token:blacklist:${token}`,
  RATE_LIMIT: (ip: string, route: string) => `ratelimit:${ip}:${route}`,
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
  PENDING: 'pending',
  SUCCESS: 'success',
  FAILED: 'failed',
  REVERSED: 'reversed',
} as const;

export const WALLET_TYPES = {
  MAIN: 'main',
  BONUS: 'bonus',
  COMMISSION: 'commission',
} as const;

export const USER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
} as const;

export const LEDGER_TYPE = {
  DEBIT: 'debit',
  CREDIT: 'credit',
} as const;

export const TRANSACTION_TYPES = {
  AIRTIME: 'airtime',
  DATA: 'data',
  CABLE: 'cable',
  ELECTRICITY: 'electricity',
  WALLET_FUNDING: 'wallet_funding',
  WALLET_TRANSFER: 'wallet_transfer',
  WITHDRAWAL: 'withdrawal',
  GIFT_CARD_PURCHASE: 'gift_card_purchase',
  GIFT_CARD_SALE: 'gift_card_sale',
  CRYPTO_PURCHASE: 'crypto_purchase',
  CRYPTO_SALE: 'crypto_sale',
  FLIGHT_BOOKING: 'flight_booking',
  REFERRAL_COMMISSION: 'referral_commission',
} as const;
