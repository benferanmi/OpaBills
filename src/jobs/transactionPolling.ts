import cron from "node-cron";
import { TransactionPollingService } from "@/services/polling/TransactionPollingService";
import logger from "@/logger";

const pollingService = new TransactionPollingService();

// Start the transaction polling cron job
// Runs every 30 seconds to check for pending transactions
export function startTransactionPolling(): void {
  logger.info("Starting transaction polling cron job...");

  // Run every 30 seconds
  cron.schedule("*/30 * * * * *", async () => {
    try {
      await pollingService.pollPendingTransactions();
    } catch (error: any) {
      logger.error("Transaction polling cron job error", error);
    }
  });

  logger.info("Transaction polling cron job started (runs every 30 seconds)");
}

// simpler cron expression (every minute)

// export function startTransactionPolling(): void {
//   logger.info("Starting transaction polling cron job...");
//
//   // Run every minute
//   cron.schedule("* * * * *", async () => {
//     try {
//       await pollingService.pollPendingTransactions();
//     } catch (error: any) {
//       logger.error("Transaction polling cron job error", error);
//     }
//   });
//
//   logger.info("Transaction polling cron job started (runs every minute)");
// }
