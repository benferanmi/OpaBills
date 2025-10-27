export const emailConfig = {
  transport: process.env.EMAIL_TRANSPORT || 'mailgun', // 'mailgun' or 'smtp'
  from: process.env.EMAIL_FROM || 'noreply@billpadi.com',
  fromName: process.env.EMAIL_FROM_NAME || 'BillPadi',
  
  // Mailgun config
  mailgun: {
    apiKey: process.env.MAILGUN_API_KEY || '',
    domain: process.env.MAILGUN_DOMAIN || '',
    host: process.env.MAILGUN_HOST || 'api.mailgun.net',
  },
  
  // SMTP config
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },
};
