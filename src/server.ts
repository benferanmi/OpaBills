import { connectDatabase } from "./config/database";
import { connectRedis } from "./config/redis";
import app from "./app";
import logger from "./logger";
import { runAllSeeders, seedServices } from "./seeders";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    logger.info("Starting server...");
    await connectDatabase();
    await connectRedis();
    // await runAllSeeders();

    // Start Express server
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
      logger.info(`Health check: http://localhost:${PORT}/health`);
    });
    // Graceful shutdown
    const gracefulShutdown = () => {
      logger.info("Received shutdown signal, closing server gracefully...");
      server.close(() => {
        logger.info("Server closed");
        6;
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error("Forced shutdown after timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", gracefulShutdown);
    process.on("SIGINT", gracefulShutdown);
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

// Start the server
startServer();
