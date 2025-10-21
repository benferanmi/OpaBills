export const emailConfig = {
  transport: process.env.EMAIL_TRANSPORT || 'gmail', // 'mailgun' or 'smtp' or 'gmail'
  from: process.env.EMAIL_FROM || 'opaferanmi01@gmail.com',
  fromName: process.env.EMAIL_FROM_NAME || 'OpaBills',
  
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

  gmail: {
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASSWORD || '',
    },
  }
};
