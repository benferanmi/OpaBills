import { Router } from "express";
import { ReferenceDataController } from "@/controllers/client/ReferenceDataController";
import { ReferenceDataService } from "@/services/client/ReferenceDataService";

import { sendSuccessResponse } from "@/utils/helpers";

const router = Router();

const referenceDataService = new ReferenceDataService();

const referenceDataController = new ReferenceDataController(
  referenceDataService
);

// Public routes (no authentication required)

// App version
router.get("/app-versions", (req, res) => {
  // TODO: Implement app version check
  res.json({
    data: {
      version: "1.0.0",
      buildNumber: 1,
      isRequired: false,
      platform: "Android",
    },
  });
});

// Banks
router.get("/banks", referenceDataController.getBanks);

// Banners
router.get("/banners", (req, res) => {
  // TODO: Implement banner fetching from database
  res.json({ data: [] });
});

// Countries and locations
router.get("/countries", referenceDataController.getAllCountries);
router.get("/states", (req, res, next) => {
  const countryId = req.query.country_id as string;
  if (!countryId) {
    return sendSuccessResponse(res, [], "No country specified");
  }
  // req.params.countryId = countryId;
  referenceDataController.getStatesByCountry(req, res, next);
});

// Crypto rates (public)
router.get("/crypto-rates", (req, res) => {
  // TODO: Implement crypto rates from CryptoService
  res.json({ data: [] });
});

// Discounts
router.get("/discount", (req, res) => {
  // TODO: Implement discount fetching from database
  res.json({ data: [] });
});

// FAQ categories
router.get("/faq-categories", (req, res) => {
  // TODO: Implement FAQ category fetching
  res.json({ data: [] });
});

// Gift card categories
router.get("/giftcard-categories", (req, res) => {
  const type = req.query.type as string;
  // TODO: Implement gift card category fetching
  res.json({ data: [] });
});

router.get("/giftcard-categories/sell", (req, res) => {
  // TODO: Implement sell gift card categories
  res.json({ data: [] });
});

router.get("/giftcard-categories/buy", (req, res) => {
  // TODO: Implement buy gift card categories (Reloadly)
  res.json({ data: [] });
});

// Gift card rates (public)
router.get("/giftcard-rates", (req, res) => {
  // TODO: Implement gift card rates
  res.json({ data: [] });
});

// ImageKit signatures
router.get("/imagekit-signature", (req, res) => {
  // TODO: Implement ImageKit signature generation for KSB uploads
  res.json({ data: {} });
});

router.get("/system-imagekit-signature", (req, res) => {
  // TODO: Implement ImageKit signature generation for system uploads
  res.json({ data: {} });
});

// Product types
router.get("/product-types", (req, res) => {
  res.json({
    data: [
      "airtime",
      "data",
      "cable",
      "electricity",
      "betting",
      "epin",
      "international-airtime",
      "internationalData",
    ],
  });
});

// Referral terms
router.get("/referral-terms", (req, res) => {
  // TODO: Implement referral terms from database
  res.json({ data: { title: "Referral Terms", body: "" } });
});

// Service charges
router.get("/service-charges", (req, res) => {
  // TODO: Implement service charges from database
  res.json({ data: [] });
});

// Service status check
router.get("/service-status-check", (req, res) => {
  const service = req.query.service as string;
  // TODO: Implement service status check from database
  res.json({ data: { service, status: "active", available: true } });
});

// Support info
router.get("/support", (req, res) => {
  res.json({
    data: {
      email: "support@billpadi.com",
      phone: "+234-XXX-XXXX-XXX",
      whatsapp: "+234-XXX-XXXX-XXX",
    },
  });
});

// System bank accounts
router.get("/system-banks", (req, res) => {
  // TODO: Implement system bank accounts from database
  res.json({ data: [] });
});

// Virtual account providers
router.get("/virtual-account-providers", (req, res) => {
  res.json({
    data: [
      { name: "Paystack", code: "paystack", active: true },
      { name: "Monnify", code: "monnify", active: true },
      { name: "Safe Haven", code: "safehaven", active: false },
    ],
  });
});

export default router;
