# BillPadi Client API

A comprehensive fintech API for bill payments, gift cards, crypto trading, flight bookings, and wallet management.

## Features
- User Authentication & Authorization
- Wallet Management & Ledger System
- Bill Payments (Airtime, Data, Cable, Electricity)
- Gift Card Trading
- Crypto Trading
- Flight Bookings
- Referral System

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure your environment variables.

## Running the Application

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Project Structure

- `/src/config` - Configuration files
- `/src/controllers` - Request handlers
- `/src/models` - Database models
- `/src/services` - Business logic
- `/src/repositories` - Data access layer
- `/src/middlewares` - Express middlewares
- `/src/routes` - API routes
- `/src/utils` - Utility functions
- `/src/validations` - Request validation schemas


//TODO

use cron job to update all thrid party products that may be in the database especially giftcards