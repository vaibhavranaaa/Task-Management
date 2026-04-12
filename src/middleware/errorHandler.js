const logger = require('../utils/logger');

/**
 * Transforms Sequelize unique-constraint errors into user-friendly 409s.
 */
const handleSequelizeUniqueConstraint = (err) => ({
  statusCode: 409,
  message: 'A user with that email already exists.',
});

/**
 * Transforms Sequelize validation errors into 400s.
 */
const handleSequelizeValidation = (err) => ({
  statusCode: 400,
  message: err.errors.map((e) => e.message).join(', '),
});

/**
 * Transforms Mongoose CastErrors (bad ObjectId) into 400s.
 */
const handleMongooseCastError = (err) => ({
  statusCode: 400,
  message: `Invalid ID format: "${err.value}"`,
});

/**
 * Transforms Mongoose validation errors into 400s.
 */
const handleMongooseValidation = (err) => ({
  statusCode: 400,
  message: Object.values(err.errors)
    .map((e) => e.message)
    .join(', '),
});

/**
 * Global Express error-handling middleware (4 args = error handler).
 * Distinguishes operational errors (safe to expose) from programming bugs.
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // ── Normalize known error types ──────────────────────────────────────────
  if (err.name === 'SequelizeUniqueConstraintError') {
    ({ statusCode, message } = handleSequelizeUniqueConstraint(err));
  } else if (err.name === 'SequelizeValidationError') {
    ({ statusCode, message } = handleSequelizeValidation(err));
  } else if (err.name === 'CastError') {
    ({ statusCode, message } = handleMongooseCastError(err));
  } else if (err.name === 'ValidationError') {
    ({ statusCode, message } = handleMongooseValidation(err));
  }

  // ── Log everything; only reveal internals in development ─────────────────
  logger.error(err);

  const response = {
    status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
    message,
  };

  // Expose stack trace only in development for easier debugging
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
