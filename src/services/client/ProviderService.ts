import { v4 as uuidv4 } from 'uuid';

interface ProviderResponse {
  success: boolean;
  reference: string;
  providerReference?: string;
  message: string;
  data?: any;
}

export class ProviderService {
  async purchaseAirtime(data: {
    phone: string;
    amount: number;
    provider: string;
  }): Promise<ProviderResponse> {
    // Mock implementation - simulate 90% success rate
    const success = Math.random() > 0.1;
    
    return {
      success,
      reference: data.phone,
      providerReference: uuidv4(),
      message: success ? 'Airtime purchase successful' : 'Airtime purchase failed',
      data: success ? { phone: data.phone, amount: data.amount } : null,
    };
  }

  async purchaseData(data: {
    phone: string;
    amount: number;
    provider: string;
    plan: string;
  }): Promise<ProviderResponse> {
    // Mock implementation - simulate 90% success rate
    const success = Math.random() > 0.1;
    
    return {
      success,
      reference: data.phone,
      providerReference: uuidv4(),
      message: success ? 'Data bundle purchase successful' : 'Data bundle purchase failed',
      data: success ? { phone: data.phone, plan: data.plan, amount: data.amount } : null,
    };
  }

  async purchaseCableTv(data: {
    smartCardNumber: string;
    amount: number;
    provider: string;
    package: string;
  }): Promise<ProviderResponse> {
    // Mock implementation - simulate 90% success rate
    const success = Math.random() > 0.1;
    
    return {
      success,
      reference: data.smartCardNumber,
      providerReference: uuidv4(),
      message: success ? 'Cable TV subscription successful' : 'Cable TV subscription failed',
      data: success ? { smartCardNumber: data.smartCardNumber, package: data.package } : null,
    };
  }

  async purchaseElectricity(data: {
    meterNumber: string;
    amount: number;
    provider: string;
    meterType: string;
  }): Promise<ProviderResponse> {
    // Mock implementation - simulate 90% success rate
    const success = Math.random() > 0.1;
    const token = success ? this.generateToken() : null;
    
    return {
      success,
      reference: data.meterNumber,
      providerReference: uuidv4(),
      message: success ? 'Electricity bill payment successful' : 'Electricity bill payment failed',
      data: success ? { meterNumber: data.meterNumber, token, amount: data.amount } : null,
    };
  }

  async purchaseGiftCard(data: {
    giftCardId: string;
    amount: number;
    quantity: number;
  }): Promise<ProviderResponse> {
    // Mock implementation - simulate 90% success rate
    const success = Math.random() > 0.1;
    
    return {
      success,
      reference: data.giftCardId,
      providerReference: uuidv4(),
      message: success ? 'Gift card purchase successful' : 'Gift card purchase failed',
      data: success
        ? {
            giftCardId: data.giftCardId,
            codes: Array.from({ length: data.quantity }, () => this.generateGiftCardCode()),
          }
        : null,
    };
  }

  private generateToken(): string {
    return Array.from({ length: 20 }, () => Math.floor(Math.random() * 10)).join('');
  }

  private generateGiftCardCode(): string {
    return Array.from({ length: 16 }, () => Math.floor(Math.random() * 10)).join('');
  }
}
