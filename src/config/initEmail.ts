import logger from "@/logger";
import nodemailer from "nodemailer";
function initializeGmail() {
  logger.debug("Initializing Gmail transport...");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  return transporter;
}

export default initializeGmail;
