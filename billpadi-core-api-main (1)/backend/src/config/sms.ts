export const smsConfig = {
  termii: {
    apiKey: process.env.TERMII_API_KEY || '',
    senderId: process.env.TERMII_SENDER_ID || 'BillPadi',
    baseUrl: process.env.TERMII_BASE_URL || 'https://api.ng.termii.com/api',
  },
};
