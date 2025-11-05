export const PROVIDERS = {
  SAVEHAVEN: {
    name: "SafeHaven",
    baseUrl: process.env.SAFEHAVEN_BASE_URL || "https://api.safehavenmfb.com",
    apiKey: process.env.SAVEHAVEN_API_KEY || "",
    clientId: process.env.SAFEHAVEN_CLIENT_ID,
    secretKey: process.env.SAFEHAVEN_CLIENT_SECRET,
    clientAssertion: process.env.SAFEHAVEN_CLIENT_ASSERTION,
  },
  FLUTTERWAVE: {
    name: "Flutterwave",
    baseUrl:
      process.env.FLUTTERWAVE_BASE_URL || "https://api.flutterwave.com/v3",
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY || "",
    publicKey: process.env.FLUTTERWAVE_PUBLIC_KEY || "",
  },
  PAYSTACK: {
    name: "Paystack",
    baseUrl: process.env.PAYSTACK_BASE_URL || "https://api.paystack.co",
    secretKey: process.env.PAYSTACK_SECRET_KEY || "",
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
  },
  MONNIFY: {
    baseUrl: process.env.MONNIFY_BASE_URL || "https://api.monnify.com",
    apiKey: process.env.MONNIFY_API_KEY || "",
    secretKey: process.env.MONNIFY_SECRET_KEY || "",
    contractCode: process.env.MONNIFY_CONTRACT_CODE || "",
    walletAccountNumber: process.env.MONNIFY_WALLET_ACCOUNT_NUMBER || "",
  },
  VTPASS: {
    baseUrl:
      process.env.VTPASS_BASE_URL || "https://api-service.vtpass.com/api",
    apiKey: process.env.VTPASS_API_KEY || "",
    secretKey: process.env.VTPASS_SECRET_KEY || "",
  },
  CLUBKONNECT: {
    baseUrl:
      process.env.CLUBKONNECT_BASE_URL || "https://www.nellobytesystems.com",
    userId: process.env.CLUBKONNECT_USER_ID || "",
    apiKey: process.env.CLUBKONNECT_API_KEY || "",
  },
  COOLSUB: {
    baseUrl: process.env.COOLSUB_BASE_URL || "https://subandgain.com/api",
    apiKey: process.env.COOLSUB_API_KEY || "",
    username: process.env.COOLSUB_USERNAME || "",
  },
  MYSIMHOSTING: {
    baseUrl:
      process.env.MYSIMHOSTING_BASE_URL || "https://api.mysimhosting.com",
    apiKey: process.env.MYSIMHOSTING_API_KEY || "",
  },
  VTUNG: {
    baseUrl: process.env.VTUNG_BASE_URL || "https://api-service.vtpass.com/api",
    username: process.env.VTUNG_USERNAME || "",
    password: process.env.VTUNG_PASSWORD || "",
    userPin: process.env.VTUNG_USER_PIN || "",
  },
  BILALSADASUB: {
    baseUrl:
      process.env.BILALSADASUB_BASE_URL || "https://bilalsadasub.com/api",
    apiKey: process.env.BILALSADASUB_API_KEY || "",
  }
} as const;

export type ProviderName = keyof typeof PROVIDERS;
