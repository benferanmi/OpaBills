import {
  TransactionResponseDTO,
  TransactionListResponseDTO,
  TransactionMetadata,
} from "@/types";

export class TransactionMapper {
  // Handle single transaction
  static toDTO(transaction: any): TransactionResponseDTO {
    return {
      id: transaction._id?.toString() || transaction.id,
      reference: transaction.reference,
      amount: transaction.amount,
      direction: transaction.direction,
      type: transaction.type,
      status: transaction.status,
      description: this.generateDescription(transaction),
      balanceBefore: transaction.balanceBefore,
      balanceAfter: transaction.balanceAfter,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
      metadata: this.getSanitizedMetadata(transaction),
    };
  }

  // Handle array of transactions
  static toDTOList(transactions: any[]): TransactionResponseDTO[] {
    return transactions.map((t) => this.toDTO(t));
  }

  // Handle paginated transactions
  static toPaginatedDTO(
    data: any[],
    total: number,
    page?: number,
    limit?: number
  ): TransactionListResponseDTO {
    return {
      data: this.toDTOList(data),
      total,
      page,
      limit,
      totalPages: limit ? Math.ceil(total / limit) : undefined,
    };
  }

  private static generateDescription(transaction: any): string {
    const meta = transaction.meta || {};

    switch (transaction.type) {
      case "wallet_transfer":
        if (transaction.direction === "DEBIT") {
          return `Transfer to ${
            meta.recipientUsername || meta.recipientEmail || "user"
          }`;
        }
        return "Transfer received";

      case "bank_transfer":
        return `Transfer to ${meta.bankName || "bank account"}`;

      case "withdrawal":
        return `Withdrawal to ${meta.bankName || "bank account"}`;

      case "wallet_funding":
      case "deposit":
        return "Wallet funded";

      case "wallet_credit":
        return meta.reason || transaction.remark || "Wallet credited";

      case "airtime":
        return `${meta.serviceName || "Airtime"} purchase`;

      case "data":
        return meta.productName
          ? `${meta.productName}`
          : `${meta.serviceName || "Data"} bundle`;

      case "electricity":
        return `${meta.serviceName || "Electricity"} bill payment`;

      case "cable_tv":
        const subType =
          meta.subscriptionType === "renew" ? "renewal" : "subscription";
        return `${meta.serviceName || "Cable TV"} ${subType}`;

      case "betting":
        return `${meta.serviceCode || "Betting"} wallet funding`;

      case "e_pin":
        return `${meta.productName || "E-Pin"} purchase`;

      case "internationalAirtime":
        return `International airtime - ${meta.countryCode || ""}`;

      case "internationalData":
        return `International data - ${meta.countryCode || ""}`;

      case "refund":
        return transaction.remark || "Refund";

      default:
        return transaction.remark || transaction.purpose || "Transaction";
    }
  }

  private static getSanitizedMetadata(
    transaction: any
  ): TransactionMetadata | undefined {
    const meta = transaction.meta || {};
    const sanitized: TransactionMetadata = {};

    switch (transaction.type) {
      case "wallet_transfer":
        if (transaction.direction === "DEBIT") {
          sanitized.recipientName =
            meta.recipientUsername || meta.recipientEmail;
          sanitized.recipientId = meta.recipientId;
        } else {
          sanitized.senderName = meta.senderInfo || "Transfer received";
        }
        if (transaction.remark) {
          sanitized.remark = transaction.remark;
        }
        break;

      case "bank_transfer":
      case "withdrawal":
        if (meta.accountNumber) {
          sanitized.accountNumber = this.maskAccountNumber(meta.accountNumber);
        }
        sanitized.bankName = meta.bankName;
        sanitized.provider = transaction.provider;
        if (meta.accountName) {
          sanitized.recipientName = meta.accountName;
        }
        break;

      case "wallet_funding":
      case "deposit":
        sanitized.provider = transaction.provider;
        if (meta.virtualAccount?.accountNumber) {
          sanitized.accountNumber = meta.virtualAccount.accountNumber;
        }
        if (meta.virtualAccount?.bankName) {
          sanitized.bankName = meta.virtualAccount.bankName;
        }
        break;

      case "airtime":
      case "internationalAirtime":
        if (meta.phone) {
          sanitized.phone = this.maskPhone(meta.phone);
        }
        sanitized.serviceName = meta.serviceName;
        sanitized.network = meta.network;
        if (meta.countryCode) {
          sanitized.provider = meta.countryCode;
        }
        break;

      case "data":
      case "internationalData":
        if (meta.phone) {
          sanitized.phone = this.maskPhone(meta.phone);
        }
        sanitized.serviceName = meta.serviceName;
        sanitized.productName = meta.productName;
        if (meta.countryCode) {
          sanitized.provider = meta.countryCode;
        }
        break;

      case "electricity":
        if (meta.meterNumber) {
          sanitized.meterNumber = this.maskAccountNumber(meta.meterNumber);
        }
        sanitized.meterType = meta.meterType;
        sanitized.serviceName = meta.serviceName;
        // Keep token - user needs it
        if (meta.token) {
          sanitized.token = meta.token;
        }
        break;

      case "cable_tv":
        if (meta.smartCardNumber) {
          sanitized.smartCardNumber = this.maskAccountNumber(
            meta.smartCardNumber
          );
        }
        sanitized.serviceName = meta.serviceName;
        sanitized.productName = meta.productName;
        sanitized.subscriptionType = meta.subscriptionType;
        break;

      case "betting":
        if (meta.customerId) {
          sanitized.customerId = meta.customerId;
        }
        sanitized.serviceName = meta.serviceCode;
        sanitized.provider = transaction.provider;
        break;

      case "e_pin":
        sanitized.serviceName = meta.serviceName;
        sanitized.productName = meta.productName;
        if (meta.profileId) {
          sanitized.profileId = meta.profileId;
        }
        // Keep pin - user needs it (but only include if present)
        if (meta.pin) {
          sanitized.pin = meta.pin;
        }
        break;

      case "refund":
      case "wallet_credit":
        if (transaction.remark) {
          sanitized.remark = transaction.remark;
        }
        if (meta.originalReference) {
          sanitized.providerReference = meta.originalReference;
        }
        break;
    }

    // Add general fields if available
    if (transaction.remark && !sanitized.remark) {
      sanitized.remark = transaction.remark;
    }

    if (transaction.providerReference && !sanitized.providerReference) {
      sanitized.providerReference = transaction.providerReference;
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  // Mask account number - first four digits

  private static maskAccountNumber(accountNumber: string): string {
    if (!accountNumber || accountNumber.length < 4) {
      return "****";
    }
    return "****" + accountNumber.slice(-4);
  }

  // Mask phone number -  first 4 and last 2 digits

  private static maskPhone(phone: string): string {
    if (!phone || phone.length < 6) {
      return "****";
    }
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 6) {
      return "****";
    }
    return cleaned.slice(0, 4) + "****" + cleaned.slice(-2);
  }
}
