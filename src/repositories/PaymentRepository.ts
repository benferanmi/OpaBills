import { BaseRepository } from "./BaseRepository";
import { Payment, IPayment } from "@/models/wallet/Payment";

export class PaymentRepository extends BaseRepository<IPayment> {
  constructor() {
    super(Payment);
  }

  async findByReference(reference: string): Promise<IPayment | null> {
    return this.model.findOne({ reference }).exec();
  }

  async findByProviderReference(
    providerReference: string,
    provider: string
  ): Promise<IPayment | null> {
    return this.model
      .findOne({
        providerReference,
        "meta.provider": provider,
      })
      .exec();
  }

  async findByProviderTransactionId(
    providerTransactionId: string,
    provider: string
  ): Promise<IPayment | null> {
    return this.model
      .findOne({
        providerTransactionId,
        "meta.provider": provider,
      })
      .exec();
  }

  async findByUserId(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = { userId, ...filters };
    return this.findWithPagination(query, page, limit, { createdAt: -1 });
  }

  async findByType(
    type: "deposit" | "withdrawal",
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = { type, ...filters };
    return this.findWithPagination(query, page, limit, { createdAt: -1 });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: string,
    additionalData?: Partial<IPayment>
  ): Promise<IPayment | null> {
    return this.model
      .findByIdAndUpdate(
        paymentId,
        {
          status,
          ...additionalData,
        },
        { new: true }
      )
      .exec();
  }

  async createPayment(data: Partial<IPayment>): Promise<IPayment> {
    return this.create(data);
  }
}
