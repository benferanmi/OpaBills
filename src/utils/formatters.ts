export const formatCurrency = (amount: number, currency: string = 'NGN'): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const formatPhoneNumber = (phone: string, phoneCode: string = '+234'): string => {
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, '');
  
  // Format as needed
  if (cleaned.startsWith('0')) {
    return `${phoneCode}${cleaned.substring(1)}`;
  }
  
  return `${phoneCode}${cleaned}`;
};
