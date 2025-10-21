export const PROVIDERS = {
  PAYSTACK: {
    name: 'Paystack',
    baseUrl: 'https://api.paystack.co',
    secretKey: process.env.PAYSTACK_SECRET_KEY,
  },
  FLUTTERWAVE: {
    name: 'Flutterwave',
    baseUrl: 'https://api.flutterwave.com/v3',
    secretKey: process.env.FLUTTERWAVE_SECRET_KEY,
  },
  SAFEHAVEN: {
    name: 'SafeHaven',
    baseUrl: 'https://api.safehavenmfb.com',
    clientId: process.env.SAFEHAVEN_CLIENT_ID,
    clientSecret: process.env.SAFEHAVEN_CLIENT_SECRET,
  },
} as const;

export type ProviderName = keyof typeof PROVIDERS;
