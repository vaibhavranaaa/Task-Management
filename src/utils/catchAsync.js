/**
 * Wraps async route handlers to eliminate repetitive try/catch blocks.
 * Any thrown error is forwarded to Express's global error handler via next().
 *
 * @param {Function} fn - Async route handler
 * @returns {Function} Express middleware
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;
