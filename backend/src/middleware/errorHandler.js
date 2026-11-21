/**
 * Error Handler Middleware
 * 
 * Centralized error handling for the application.
 * Provides consistent error response format.
 */

import config from "../config/index.js";
import { AppError } from "../utils/AppError.js";

/**
 * Handle 404 Not Found errors
 */
export const notFoundHandler = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

/**
 * An error that carries `retryAfter` (a request that came too soon) tells the client how many seconds
 * to wait, in the body and in the Retry-After header
 * @param {Object} err - The error
 * @param {Object} res - Express response
 * @returns {Object} What to add to the body
 */
const retryAfterOf = (err, res) => {
  if (typeof err.retryAfter !== "number") {
    return {};
  }
  res.set("Retry-After", String(err.retryAfter));
  return { retryAfter: err.retryAfter };
};

/**
 * Send error response in development environment
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    ...retryAfterOf(err, res),
  });
};

/**
 * Send error response in production environment
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      ...retryAfterOf(err, res),
    });
  } else {
    // Programming or unknown error: don't leak error details
    console.error("ERROR 💥:", err);
    
    res.status(500).json({
      status: "error",
      message: "Something went wrong",
    });
  }
};

/**
 * Global error handler middleware
 */
export const errorHandler = (err, req, res, _next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";
  
  if (config.nodeEnv === "development") {
    sendErrorDev(err, res);
  } else {
    const error = { ...err };
    error.message = err.message;
    sendErrorProd(error, res);
  }
};
