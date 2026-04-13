const jwt = require('jsonwebtoken');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Generates a signed JWT for the given user ID.
 * @param {string} userId
 * @returns {string} JWT
 */
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/**
 * Creates a new user account. Password is hashed by the User model hook.
 */
const register = catchAsync(async (req, res) => {
  const { name, email, password } = req.body;

  const user = await User.create({ name, email, password });
  const token = signToken(user.id);

  res.status(201).json({
    status: 'success',
    token,
    data: { user: user.toSafeObject() },
  });
});

/**
 * Authenticates a user and returns a JWT.
 */
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  const user = await User.findOne({ where: { email } });

  const passwordMatch = user ? await user.verifyPassword(password) : false;

  if (!user || !passwordMatch) {

    return next(new AppError('Invalid email or password.', 401));
  }

  const token = signToken(user.id);

  res.status(200).json({
    status: 'success',
    token,
    data: { user: user.toSafeObject() },
  });
});

/**
 * Returns the authenticated user's profile. Requires protect middleware.
 */
const getMe = catchAsync(async (req, res) => {
  res.status(200).json({
    status: 'success',
    data: { user: req.user.toSafeObject() },
  });
});

module.exports = { register, login, getMe };
