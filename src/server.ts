import { config } from "dotenv";
config();
import { connectDatabase } from "./config/database";
import { connectRedis, disconnectRedis } from "./config/redis";
import app from "./app";
import logger from "./logger";
import mongoose from "mongoose";

const PORT = process.env.PORT || 5000;

let server: any = null;

const startServer = async () => {
  try {
    logger.info("Starting server...");

    await connectRedis();
    await connectDatabase();

    // Start Express server
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal: string) => {
      logger.info(`Received ${signal} signal, closing server gracefully...`);

      let isShuttingDown = false;

      if (isShuttingDown) {
        logger.warn("Shutdown already in progress, ignoring duplicate signal");
        return;
      }

      isShuttingDown = true;

      const forceShutdownTimer = setTimeout(() => {
        logger.error("Forced shutdown after 10s timeout");
        process.exit(1);
      }, 10000);

      try {
        // 1. Stop accepting new connections
        if (server) {
          await new Promise<void>((resolve) => {
            server.close((err: Error) => {
              if (err) {
                logger.error("Error closing HTTP server:", err);
              } else {
                logger.info("HTTP server closed");
              }
              resolve();
            });
          });
        }

        // 2. Close Redis connection
        try {
          await disconnectRedis();
          logger.info("Redis connection closed");
        } catch (error) {
          logger.error("Error closing Redis:", error);
        }

        // 3. Close MongoDB connection
        try {
          await mongoose.connection.close();
          logger.info("MongoDB connection closed");
        } catch (error) {
          logger.error("Error closing MongoDB:", error);
        }

        clearTimeout(forceShutdownTimer);
        logger.info("Graceful shutdown completed");
        process.exit(0);
      } catch (error) {
        logger.error("Error during graceful shutdown:", error);
        clearTimeout(forceShutdownTimer);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  console.error("Unhandled error:", reason);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  console.error("Unhandled error:", error);
});

startServer();
