
export interface TransactionResponseDTO {
  id: string;
  reference: string;
  amount: number;
  direction: 'CREDIT' | 'DEBIT';
  type: string;
  status: string;
  purpose: string;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
  updatedAt?: Date;
  
  // Optional metadata (sanitized)
  metadata?: TransactionMetadata;
}

export interface TransactionMetadata {
  // Provider (from transaction level, not meta)
  provider?: string;
  providerReference?: string;
  
  // Wallet transfers
  recipientName?: string;
  recipientId?: string;
  senderName?: string;
  senderId?: string;
  transferId?: string;
  
  // Bank transfers / Withdrawals
  accountNumber?: string;  // Masked
  accountName?: string;
  bankName?: string;
  bankCode?: string;
  
  // Airtime / Data / Bill Payments (UI needs these)
  phone?: string;  // Masked
  serviceName?: string;
  serviceCode?: string;
  productName?: string;
  network?: string;
  logo?: string;
  
  // Electricity
  meterNumber?: string;  // Masked
  meterType?: string;
  token?: string;  // Keep for user to access
  
  // Cable TV
  smartCardNumber?: string;  // Masked
  subscriptionType?: string;
  
  // Betting
  customerId?: string;
  
  // E-Pin
  profileId?: string;
  pin?: string;  // Keep for user to access
  
  // International transactions
  countryCode?: string;
  
  // Fees (for deposits/withdrawals)
  fees?: number;
  vat?: number;
  grossAmount?: number;
  netAmount?: number;
  
  // Response messages
  responseMessage?: string;
  
  // Refund specific
  originalReference?: string;
  reason?: string;
  
  // General
  remark?: string;
}

export interface TransactionListResponseDTO {
  data: TransactionResponseDTO[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}