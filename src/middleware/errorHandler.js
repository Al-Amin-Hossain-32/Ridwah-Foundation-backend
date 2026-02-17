/**
 * Global Error Handler Middleware
 * 
 * Why?
 * - Centralized error handling
 * - Consistent error response format
 * - Log errors in one place
 * - Handle different error types
 * 
 * Must be LAST middleware in app.use() chain
 */
const errorHandler = (err, req, res, next) => {
  // Log error for debugging
  console.error('❌ Error:', err);

  // Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  // Mongoose validation error
  // Example: Required field missing
  if (err.name === 'ValidationError') {
    statusCode = 400;
    const messages = Object.values(err.errors).map((val) => val.message);
    message = messages.join(', ');
  }

  // Mongoose duplicate key error
  // Example: Phone number already exists
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyPattern)[0];
    message = `${field} already exists`;
  }

  // Mongoose cast error
  // Example: Invalid ObjectId format
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Send response
  res.status(statusCode).json({
    success: false,
    message,
    // Include stack trace in development only
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

export default errorHandler;