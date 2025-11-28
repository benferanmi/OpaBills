export interface TransactionResponseDTO {
  id: string;
  reference: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  type: string;
  status: string;
  description: string;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: Date;
  updatedAt?: Date;

  // Optional metadata (sanitized)
  metadata?: TransactionMetadata;
}

export interface TransactionMetadata {
  // Wallet transfers
  recipientName?: string;
  recipientId?: string;
  senderName?: string;

  // Bank transfers / Withdrawals
  accountNumber?: string;
  bankName?: string;

  // Airtime / Data
  phone?: string; // Masked
  serviceName?: string;
  productName?: string;
  network?: string;

  // Electricity
  meterNumber?: string; // Masked
  meterType?: string;
  token?: string;

  // Cable TV
  smartCardNumber?: string; // Masked
  subscriptionType?: string;

  // Betting
  customerId?: string;

  // E-Pin
  profileId?: string;
  pin?: string;

  // General
  remark?: string;
  provider?: string;
  providerReference?: string;
}

export interface TransactionListResponseDTO {
  data: TransactionResponseDTO[];
  total: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}
