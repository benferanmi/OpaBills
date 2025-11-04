import { Router } from "express";
import adminRoute from "./admin";
import clientRoute from "./client";
import initializeGmail from "@/config/initEmail";

const router = Router();

router.use("/admin", adminRoute);
router.use("/", clientRoute);

router.get("/", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

router.get("/test-email", async (req, res) => {
  try {
    const transporter = initializeGmail();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: "benferanmiopafunso@gmail.com",
      subject: "Test Email from Render",
      text: "If you got this, your Render email setup works!",
    });

    res.send("Email sent successfully!");
  } catch (error) {
    console.error(error);
    res.status(500).send("Email failed to send.");
  }
});

export default router;
