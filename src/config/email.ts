export const emailConfig = {
  transport: process.env.EMAIL_TRANSPORT || "gmail", // 'mailgun' or 'smtp' or 'gmail'
  from: process.env.EMAIL_FROM || "opaferanmi01@gmail.com",
  fromName: process.env.EMAIL_FROM_NAME || "OpaBills",

  // Mailgun config
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || "",
    domain: process.env.MAILGUN_DOMAIN || "",
    host: process.env.MAILGUN_HOST || "api.mailgun.net",
  },

  gmail: {
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER || "",
      pass: process.env.EMAIL_PASSWORD || "",
    },
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY,
  },
};
