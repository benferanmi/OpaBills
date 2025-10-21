import { Payment } from '@/models/wallet/Payment';
import { WalletService } from './WalletService';
import { generateReference } from '@/utils/helpers';
import { AppError } from '@/middlewares/errorHandler';
import { HTTP_STATUS, ERROR_CODES } from '@/utils/constants';

export interface InitializePaymentDTO {
  userId: string;
  amount: number;
  meta?: any;
}

export class PaymentService {
  constructor(private walletService: WalletService) {}

  async initializePayment(data: InitializePaymentDTO): Promise<any> {
    const reference = generateReference('PAY');

    const payment = await Payment.create({
      userId: data.userId,
      reference,
      amount: data.amount,
      status: 'pending',
      meta: data.meta,
    });

    return {
      reference: payment.reference,
      amount: payment.amount,
      status: payment.status,
    };
  }

  async verifyPayment(reference: string): Promise<any> {
    const payment = await Payment.findOne({ reference });
    if (!payment) {
      throw new AppError('Payment not found', HTTP_STATUS.NOT_FOUND, ERROR_CODES.NOT_FOUND);
    }

    // In production, verify with payment provider
    // For now, simulate successful payment
    payment.status = 'success';
    payment.amountPaid = payment.amount;
    await payment.save();

    // Credit user wallet
    await this.walletService.creditWallet(
      payment.userId,
      payment.amount,
      `Wallet funding via ${reference}`
    );

    return {
      reference: payment.reference,
      amount: payment.amount,
      status: payment.status,
    };
  }
}
