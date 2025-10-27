import { FlightRepository } from "@/repositories/FlightRepository";
import { TransactionRepository } from "@/repositories/TransactionRepository";
import { NotificationRepository } from "@/repositories/NotificationRepository";
import { WalletService } from "./WalletService";
import { AppError } from "@/middlewares/errorHandler";
import { HTTP_STATUS, ERROR_CODES } from "@/utils/constants";
import { Types } from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { generateReference } from "@/utils/helpers";

export class FlightService {
  private flightRepository: FlightRepository;
  private transactionRepository: TransactionRepository;
  private walletService: WalletService;
  private notificationRepository: NotificationRepository;
  constructor() {
    this.flightRepository = new FlightRepository();
    this.transactionRepository = new TransactionRepository();
    this.walletService = new WalletService();
    this.notificationRepository = new NotificationRepository();
  }

  async searchFlights(data: {
    origin: string;
    destination: string;
    departureDate: string;
    returnDate?: string;
    adults: number;
    children?: number;
    infants?: number;
    travelClass?: string;
  }) {
    // Mock flight search response
    const mockOffers = [
      {
        id: uuidv4(),
        price: {
          currency: "NGN",
          total: 125000,
          base: 120000,
          taxes: 5000,
        },
        itineraries: [
          {
            duration: "PT2H30M",
            segments: [
              {
                departure: {
                  iataCode: data.origin,
                  at: data.departureDate,
                },
                arrival: {
                  iataCode: data.destination,
                  at: data.departureDate,
                },
                carrierCode: "LK",
                number: "501",
                aircraft: { code: "738" },
              },
            ],
          },
        ],
        validatingAirlineCodes: ["LK"],
      },
    ];

    return mockOffers;
  }

  async createFlightBooking(data: {
    userId: string;
    offerId: string;
    passengers: any[];
    ticketingAgreement?: any;
  }) {
    const reference = generateReference();

    // Mock offer validation - in production, verify with Amadeus
    const mockOffer = {
      id: data.offerId,
      price: { total: 125000 },
    };

    const amount = mockOffer.price.total;

    // Get user wallet
    const wallet = await this.walletService.getWallet(data.userId);
    if (!wallet) {
      throw new AppError(
        "Wallet not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }

    // Check balance
    if (wallet.balance < amount) {
      throw new AppError(
        "Insufficient wallet balance",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.INSUFFICIENT_BALANCE
      );
    }

    // Deduct from wallet
    await this.walletService.debitWallet(
      data.userId,
      amount,
      "Flight booking",
      "main"
    );

    // Create flight booking
    const flightBooking = await this.flightRepository.create({
      _id: uuidv4(),
      userId: new Types.ObjectId(data.userId),
      reference,
      amount,
      passengers: data.passengers,
      ticketingAgreement: data.ticketingAgreement,
      offer: mockOffer,
      status: "pending",
    });

    // Create main transaction
    const transaction = await this.transactionRepository.create({
      walletId: wallet._id,
      sourceId: new Types.ObjectId(data.userId),
      transactableType: "FlightBooking",
      transactableId: new Types.ObjectId(flightBooking._id),
      reference,
      amount,
      type: "flight_booking",
      provider: "amadeus",
      remark: `Flight booking`,
      purpose: "flight_booking",
      status: "pending",
      meta: { passengers: data.passengers.length },
    });

    // Mock Amadeus API call
    try {
      // Simulate booking confirmation (random success/fail for demo)
      const success = Math.random() > 0.1; // 90% success rate
      const status = success ? "confirmed" : "failed";
      const bookingId = success ? `BOOK${Date.now()}` : undefined;

      await this.flightRepository.update(flightBooking._id, {
        status,
        bookingId,
      });
      await this.transactionRepository.updateStatus(
        transaction._id,
        success ? "success" : "failed"
      );

      // Send notification
      await this.notificationRepository.create({
        type: success ? "transaction_success" : "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "Flight Booking",
          amount,
          reference,
        },
      });

      // If failed, reverse wallet deduction
      if (!success) {
        await this.walletService.creditWallet(
          data.userId,
          amount,
          "Flight booking failed - refund",
          "main"
        );
      }

      return {
        ...flightBooking.toObject(),
        status,
        bookingId,
      };
    } catch (error) {
      // Reverse wallet deduction on error
      await this.flightRepository.updateStatus(flightBooking._id, "failed");
      await this.transactionRepository.updateStatus(transaction._id, "failed");
      await this.walletService.creditWallet(
        data.userId,
        amount,
        "Flight booking error - refund",
        "main"
      );

      // Send failure notification
      await this.notificationRepository.create({
        type: "transaction_failed",
        notifiableType: "User",
        notifiableId: new Types.ObjectId(data.userId),
        data: {
          transactionType: "Flight Booking",
          amount,
          reference,
        },
      });

      throw error;
    }
  }

  async getFlightBookings(
    userId: string,
    filters: any = {},
    page: number = 1,
    limit: number = 10
  ) {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) {
        query.createdAt.$gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        query.createdAt.$lte = new Date(filters.endDate);
      }
    }

    return this.flightRepository.findByUserId(userId, query, page, limit);
  }

  async getFlightBookingById(bookingId: string) {
    const booking = await this.flightRepository.findById(bookingId);
    if (!booking) {
      throw new AppError(
        "Flight booking not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return booking;
  }

  async getFlightBookingByReference(reference: string) {
    const booking = await this.flightRepository.findByReference(reference);
    if (!booking) {
      throw new AppError(
        "Flight booking not found",
        HTTP_STATUS.NOT_FOUND,
        ERROR_CODES.RESOURCE_NOT_FOUND
      );
    }
    return booking;
  }

  async cancelFlightBooking(bookingId: string, userId: string) {
    const booking = await this.getFlightBookingById(bookingId);

    // Verify ownership
    if (booking.userId.toString() !== userId) {
      throw new AppError(
        "Unauthorized",
        HTTP_STATUS.FORBIDDEN,
        ERROR_CODES.AUTHORIZATION_ERROR
      );
    }

    // Check if cancellable
    if (booking.status !== "confirmed") {
      throw new AppError(
        "Booking cannot be cancelled",
        HTTP_STATUS.BAD_REQUEST,
        ERROR_CODES.VALIDATION_ERROR
      );
    }

    // Update status
    await this.flightRepository.updateStatus(bookingId, "cancelled");

    // Refund to wallet
    await this.walletService.creditWallet(
      userId,
      booking.amount,
      `Flight booking cancellation - ${booking.reference}`,
      "main"
    );

    // Create reversal transaction
    await this.transactionRepository.create({
      sourceId: new Types.ObjectId(userId),
      reference: `REV-${booking.reference}`,
      amount: booking.amount,
      type: "refund",
      provider: "internal",
      remark: `Flight booking cancellation refund`,
      purpose: "refund",
      status: "success",
      meta: { originalReference: booking.reference },
    });

    // Send notification
    await this.notificationRepository.create({
      type: "wallet_credit",
      notifiableType: "User",
      notifiableId: new Types.ObjectId(userId),
      data: {
        amount: booking.amount,
        reference: `REV-${booking.reference}`,
      },
    });

    return booking;
  }

  async getAirlines() {
    return [
      { code: "LK", name: "Air Peace" },
      { code: "W3", name: "Arik Air" },
      { code: "AJ", name: "Aero Contractors" },
      { code: "OJ", name: "Overland Airways" },
      { code: "VK", name: "ValueJet" },
      { code: "AB", name: "Air Berlin" },
      { code: "BA", name: "British Airways" },
      { code: "EK", name: "Emirates" },
      { code: "LH", name: "Lufthansa" },
      { code: "AF", name: "Air France" },
    ];
  }

  async searchCities(keyword: string) {
    const mockCities = [
      { iataCode: "LOS", name: "Lagos", country: "Nigeria" },
      { iataCode: "ABV", name: "Abuja", country: "Nigeria" },
      { iataCode: "PHC", name: "Port Harcourt", country: "Nigeria" },
      { iataCode: "KAN", name: "Kano", country: "Nigeria" },
      { iataCode: "LHR", name: "London", country: "United Kingdom" },
      { iataCode: "DXB", name: "Dubai", country: "UAE" },
      { iataCode: "JFK", name: "New York", country: "USA" },
      { iataCode: "CDG", name: "Paris", country: "France" },
    ];

    if (!keyword) return mockCities;

    const lowerKeyword = keyword.toLowerCase();
    return mockCities.filter(
      (city) =>
        city.name.toLowerCase().includes(lowerKeyword) ||
        city.iataCode.toLowerCase().includes(lowerKeyword) ||
        city.country.toLowerCase().includes(lowerKeyword)
    );
  }

  async getFlightClasses() {
    return [
      { code: "ECONOMY", name: "Economy" },
      { code: "PREMIUM_ECONOMY", name: "Premium Economy" },
      { code: "BUSINESS", name: "Business" },
      { code: "FIRST", name: "First Class" },
    ];
  }

  async validateOfferPrice(offerId: string) {
    // Mock validation - in production, call Amadeus API
    return {
      offerId,
      valid: true,
      price: {
        currency: "NGN",
        total: 125000,
        base: 120000,
        taxes: 5000,
      },
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };
  }
}
