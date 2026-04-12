const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectMongo = async () => {
  const uri = process.env.MONGODB_URI;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  logger.info('✅ MongoDB connected');
};

module.exports = { connectMongo };
