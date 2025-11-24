import { Router } from "express";
import { WebhookController } from "@/controllers/WebhookController";
const router = Router();

const webhookController = new WebhookController();

// VTPASS
router.post("/vtpass", webhookController.handleVTPassWebhook);

// SAFEHAVEN
router.post("/safehaven", webhookController.handleSafeHavenWebhook);

// FLUTTERWAVE
router.post("/flutterwave", webhookController.handleFlutterwaveWebhook);

// MONNIFY
router.post("/monnify", webhookController.handleMonnifyWebhook);

//✅ COOLSUB
// router.post("/webhook/coolsub", coolsubController.handleWebhook);
//TODO: Add CoolSub webhook handler

//✅ MYSIMHOSTING
// router.post("/webhook/mysimhosting", mysimhostingController.handleWebhook);
//TODO: Add MySimHosting webhook handler

//✅ VTUNG
// router.post("/webhook/vtung", vtungController.handleWebhook);
//TODO: Add Vtung webhook handler

//✅ BILALSADASUB
// router.post("/webhook/bilalsadasub", bilalsadasubController.handleWebhook);
//TODO: Add BilalSadaSub webhook handler

//✅ GIFTBILLS
// router.post("/webhook/giftbills", giftbillsController.handleWebhook);
//TODO: Add GiftBills webhook handler

//✅ AMADEUS
// router.post("/webhook/amadeus", amadeusController.handleWebhook);
//TODO: Add Amadeus webhook handler

//============================================
//PROVIDERS NOT IN YOUR CONFIG
//============================================

//❌ PAYSTACK
// router.post("/webhook/paystack", paystackController.handleWebhook);
//TODO: Add Paystack webhook handler

//❌ INTERSWITCH
// router.post("/webhook/interswitch", interswitchController.handleWebhook);
//TODO: Add Interswitch webhook handler

//❌ SQUAD
// router.post("/webhook/squad", squadController.handleWebhook);
//TODO: Add Squad webhook handler

//❌ PAGA
// router.post("/webhook/paga", pagaController.handleWebhook);
//TODO: Add Paga webhook handler

//❌ KORAPAY
// router.post("/webhook/korapay", korapayController.handleWebhook);
//TODO: Add Korapay webhook handler

//❌ PAYAZA
// router.post("/webhook/payaza", payazaController.handleWebhook);
//TODO: Add Payaza webhook handler

//❌ KUDA
// router.post("/webhook/kuda", kudaController.handleWebhook);
//TODO: Add Kuda webhook handler

//❌ PROVIDUS
// router.post("/webhook/providus", providusController.handleWebhook);
//TODO: Add Providus webhook handler

//❌ WEMA
// router.post("/webhook/wema", wemaController.handleWebhook);
//TODO: Add Wema webhook handler

export default router;
