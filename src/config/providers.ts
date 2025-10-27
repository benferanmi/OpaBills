export const PROVIDERS = {
  SAVEHAVEN: {
    name: "SafeHaven",
    baseUrl: "https://api.safehavenmfb.com",
    apiKey: process.env.MONNIFY_API_KEY || "",
    clientId: process.env.SAFEHAVEN_CLIENT_ID,
    secretKey: process.env.SAFEHAVEN_CLIENT_SECRET,
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
} as const;

export type ProviderName = keyof typeof PROVIDERS;
