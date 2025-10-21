import { config } from "dotenv";
config();
import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import routes from "./routes";
import adminRoute from "./routes/admin/"
import { AppError, errorHandler } from "./middlewares/errorHandler";
import { rateLimiter } from "./middlewares/rateLimiter";
import { devLogger } from "./middlewares/requestLogger";
import { ERROR_CODES, HTTP_STATUS } from "./utils/constants";


const app: Application = express();

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
app.use(rateLimiter());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use(devLogger);
}

// API routes
app.use("/api/v1", adminRoute);


app.use((req, res, next) => {
  const error = new AppError(
    `Cannot ${req.method} ${req.path}`,
    HTTP_STATUS.NOT_FOUND,
    ERROR_CODES.NOT_FOUND
  );
  next(error);
});

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
