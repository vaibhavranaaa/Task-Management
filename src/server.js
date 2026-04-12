require('dotenv').config();
const app = require('./app');
const { connectPostgres } = require('./config/postgres');
const { connectMongo } = require('./config/mongo');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

/**
 * Connects to both databases before starting the HTTP server.
 * If either connection fails, the process exits with a non-zero code
 * so container orchestrators (Docker, k8s) know to restart the pod.
 */
const startServer = async () => {
  try {
    await connectPostgres();
    await connectMongo();

    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // ── Graceful Shutdown ────────────────────────────────────────────────────
    const shutdown = (signal) => {
      logger.info(`${signal} received. Shutting down gracefully…`);
      server.close(() => {
        logger.info('HTTP server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Catch unhandled promise rejections (e.g., lost DB connection mid-run)
    process.on('unhandledRejection', (err) => {
      logger.error('UNHANDLED REJECTION:', err);
      server.close(() => process.exit(1));
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
