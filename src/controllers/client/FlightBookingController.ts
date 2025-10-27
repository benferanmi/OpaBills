import { Response, NextFunction } from "express";
import { AuthRequest } from "@/middlewares/auth";
import { FlightService } from "@/services/client/FlightService";
import { sendSuccessResponse, sendPaginatedResponse } from "@/utils/helpers";

export class FlightBookingController {
  private flightService: FlightService;
  constructor() {
    this.flightService = new FlightService();
  }

  searchFlights = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const data = req.query;
      const flights = await this.flightService.searchFlights(data as any);
      return sendSuccessResponse(
        res,
        flights,
        "Flights retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  createFlightBooking = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const data = { ...req.body, userId };
      const booking = await this.flightService.createFlightBooking(data);
      return sendSuccessResponse(
        res,
        booking,
        "Flight booking created successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getFlightBookings = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const filters = {
        status: req.query.status as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
      };

      const result = await this.flightService.getFlightBookings(
        userId,
        filters,
        page,
        limit
      );

      return sendPaginatedResponse(
        res,
        result.data,
        { total: result.total, page, limit },
        "Flight bookings retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getFlightBookingById = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { bookingId } = req.params;
      const booking = await this.flightService.getFlightBookingById(bookingId);
      return sendSuccessResponse(
        res,
        booking,
        "Flight booking retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getFlightBookingByReference = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { reference } = req.params;
      const booking = await this.flightService.getFlightBookingByReference(
        reference
      );
      return sendSuccessResponse(
        res,
        booking,
        "Flight booking retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  cancelFlightBooking = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const userId = req.user!.id;
      const { bookingId } = req.params;
      const booking = await this.flightService.cancelFlightBooking(
        bookingId,
        userId
      );
      return sendSuccessResponse(
        res,
        booking,
        "Flight booking cancelled successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getAirlines = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const airlines = await this.flightService.getAirlines();
      return sendSuccessResponse(
        res,
        airlines,
        "Airlines retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  searchCities = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { keyword } = req.query;
      const cities = await this.flightService.searchCities(keyword as string);
      return sendSuccessResponse(res, cities, "Cities retrieved successfully");
    } catch (error) {
      next(error);
    }
  };

  getFlightClasses = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const classes = await this.flightService.getFlightClasses();
      return sendSuccessResponse(
        res,
        classes,
        "Flight classes retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  getFlightOffers = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const offers = await this.flightService.searchFlights(req.query as any);
      return sendSuccessResponse(
        res,
        offers,
        "Flight offers retrieved successfully"
      );
    } catch (error) {
      next(error);
    }
  };

  validateOfferPrice = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const { offerId } = req.params;
      const result = await this.flightService.validateOfferPrice(offerId);
      return sendSuccessResponse(
        res,
        result,
        "Offer price validated successfully"
      );
    } catch (error) {
      next(error);
    }
  };
}
